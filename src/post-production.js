/**
 * @module post-production
 * Post-Production Pipeline — transitions, title cards, credits, aspect ratios,
 * and multiple export formats.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * @typedef {object} ExportConfig
 * @property {string} format — "mp4" | "webm" | "gif" | "png-sequence"
 * @property {string} quality — "draft" | "standard" | "cinematic"
 * @property {number} fps
 * @property {number} width
 * @property {number} height
 * @property {string} [aspectRatio] — "16:9" | "2.39:1" | "4:3" | "1:1"
 * @property {string} [codec]
 * @property {string} [preset]
 * @property {number} [crf]
 * @property {boolean} [letterbox] — Add black bars for cinematic aspect ratio
 */

// ── Quality Presets ───────────────────────────────────────────────────

const QUALITY_PRESETS = {
  draft:     { fps: 15, width: 960,  height: 540,  codec: 'libx264', preset: 'ultrafast', crf: 28 },
  standard:  { fps: 24, width: 1920, height: 1080, codec: 'libx264', preset: 'medium',    crf: 20 },
  cinematic: { fps: 24, width: 2560, height: 1440, codec: 'libx264', preset: 'slow',      crf: 16 },
  high_fps:  { fps: 60, width: 1920, height: 1080, codec: 'libx264', preset: 'fast',      crf: 22 },
};

// ── Aspect Ratios ─────────────────────────────────────────────────────

const ASPECT_RATIOS = {
  '16:9':  16 / 9,
  '2.39:1': 2.39,
  '4:3':  4 / 3,
  '1:1':  1,
};

/**
 * Calculate crop dimensions for letterboxing to a target aspect ratio.
 * @param {number} width
 * @param {number} height
 * @param {string} targetRatio — e.g. "2.39:1"
 * @returns {{ cropW: number, cropH: number, padX: number, padY: number }}
 */
function calculateLetterbox(width, height, targetRatio = '2.39:1') {
  const targetAR = ASPECT_RATIOS[targetRatio] ?? (16 / 9);
  const currentAR = width / height;

  let cropW, cropH, padX, padY;

  if (currentAR > targetAR) {
    // Video is wider than target — pillarbox (add side bars)
    cropH = height;
    cropW = Math.round(height * targetAR);
    padX = Math.round((width - cropW) / 2);
    padY = 0;
  } else {
    // Video is taller than target — letterbox (add top/bottom bars)
    cropW = width;
    cropH = Math.round(width / targetAR);
    padX = 0;
    padY = Math.round((height - cropH) / 2);
  }

  return { cropW, cropH, padX, padY };
}

// ── Transitions ───────────────────────────────────────────────────────

/**
 * Apply a transition between two clips.
 *
 * @param {string} clipA — First clip path
 * @param {string} clipB — Second clip path
 * @param {string} outputPath — Output path
 * @param {object} [opts]
 * @param {string} [opts.type="cut"] — "cut" | "fade" | "dissolve" | "dip-to-black" | "whip"
 * @param {number} [opts.duration=0.5] — Transition duration in seconds
 * @returns {Promise<string>}
 */
export async function applyTransition(clipA, clipB, outputPath, opts = {}) {
  const { type = 'cut', duration = 0.5 } = opts;

  switch (type) {
    case 'cut':
      return concatenateClips([clipA, clipB], outputPath);

    case 'fade': {
      // Fade out of A, fade in to B
      return await runFFmpeg([
        '-y',
        '-i', clipA,
        '-i', clipB,
        '-filter_complex',
        `[0:v]fade=t=out:st=0:d=${duration},setpts=PTS-STARTPTS[v0];` +
        `[1:v]fade=t=in:st=0:d=${duration},setpts=PTS-STARTPTS[v1];` +
        `[v0][v1]concat=n=2:v=1:a=0[v]`,
        '-map', '[v]',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        outputPath,
      ]);
    }

    case 'dissolve': {
      return await runFFmpeg([
        '-y',
        '-i', clipA,
        '-i', clipB,
        '-filter_complex',
        `[0:v][1:v]blend=all_expr='A*(1-T/(${duration}*TB))+B*(T/(${duration}*TB))'[v]`,
        '-map', '[v]',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        outputPath,
      ]);
    }

    case 'dip-to-black': {
      return await runFFmpeg([
        '-y',
        '-i', clipA,
        '-i', clipB,
        '-filter_complex',
        `[0:v]fade=t=out:st=0:d=${duration}[v0];` +
        `[1:v]fade=t=in:st=0:d=${duration}[v1];` +
        `[v0][v1]concat=n=2:v=1:a=0[v]`,
        '-map', '[v]',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        outputPath,
      ]);
    }

    case 'whip': {
      // Fast horizontal blur transition (simplified with zoom + motion blur effect)
      return await runFFmpeg([
        '-y',
        '-i', clipA,
        '-i', clipB,
        '-filter_complex',
        `[0:v]split=2[z][a];[z]trim=0:${duration},scale=iw*2:ih:flags=neighbor,setpts=0.5*PTS,boxblur=10:0[zoomed];` +
        `[a]trim=${duration}:99999[restA];` +
        `[zoomed][restA]concat=n=2:v=1:a=0[v0];` +
        `[1:v]split=2[bz][b];[bz]trim=0:${duration},scale=iw*2:ih:flags=neighbor,setpts=0.5*PTS,boxblur=10:0[zoomed2];` +
        `[b]trim=${duration}:99999[restB];` +
        `[zoomed2][restB]concat=n=2:v=1:a=0[v1];` +
        `[v0][v1]concat=n=2:v=1:a=0[v]`,
        '-map', '[v]',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        outputPath,
      ]);
    }

    default:
      return concatenateClips([clipA, clipB], outputPath);
  }
}

/**
 * Apply transitions across a timeline of clips, producing a single output.
 *
 * @param {string[]} clipPaths
 * @param {string[]} transitions — One fewer than clips: "cut" | "fade" | "dissolve" | "dip-to-black"
 * @param {string} outputPath
 * @param {number} [transitionDuration=0.5]
 * @returns {Promise<string>}
 */
export async function applyTimelineTransitions(clipPaths, transitions, outputPath, transitionDuration = 0.5) {
  if (clipPaths.length <= 1) {
    return concatenateClips(clipPaths, outputPath);
  }

  let current = clipPaths[0];

  for (let i = 0; i < transitions.length && i < clipPaths.length - 1; i++) {
    const next = clipPaths[i + 1];
    const transitionType = transitions[i];
    const tempOutput = i === transitions.length - 1
      ? outputPath
      : path.join(path.dirname(outputPath), `_trans_${i}.mp4`);

    await applyTransition(current, next, tempOutput, {
      type: transitionType,
      duration: transitionDuration,
    });

    if (tempOutput !== outputPath) {
      current = tempOutput;
    }
  }

  return outputPath;
}

// ── Title Cards ───────────────────────────────────────────────────────

/**
 * Generate a title card and prepend it to a video.
 *
 * @param {string} titleText
 * @param {string} videoPath — Original video
 * @param {string} outputPath — Output with title card
 * @param {object} [opts]
 * @param {number} [opts.duration=4] — Title card duration in seconds
 * @param {string} [opts.subtitle] — Subtitle text (e.g. "A Film by...")
 * @param {string} [opts.fontColor='white'] — Title color
 * @param {number} [opts.fontSize=72] — Font size
 * @returns {Promise<string>}
 */
export async function addTitleCard(titleText, videoPath, outputPath, opts = {}) {
  const {
    duration = 4,
    subtitle = '',
    fontColor = 'white',
    fontSize = 72,
  } = opts;

  const drawText = `drawtext=text='${titleText.replace(/'/g, "'\\''")}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=(h-text_h)/2`;

  let filter = drawText;
  if (subtitle) {
    filter += `,drawtext=text='${subtitle.replace(/'/g, "'\\''")}':fontsize=${Math.round(fontSize * 0.5)}:fontcolor=grey:x=(w-text_w)/2:y=(h+text_h)/2+20`;
  }

  // Create title card video
  const titleCard = path.join(path.dirname(outputPath), '_title_card.mp4');
  await runFFmpeg([
    '-y',
    '-f', 'lavfi', '-i', `color=c=black:s=1920x1080:d=${duration}`,
    '-vf', filter,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-t', String(duration),
    titleCard,
  ]);

  // Concatenate title + main video
  await concatenateClips([titleCard, videoPath], outputPath);

  // Cleanup temp
  try { await fs.unlink(titleCard); } catch {}

  return outputPath;
}

// ── Credits ───────────────────────────────────────────────────────────

/**
 * Generate scrolling credits and append to a video.
 *
 * @param {string} videoPath
 * @param {string} outputPath
 * @param {object} opts
 * @param {string} opts.title — Film title
 * @param {string[]} opts.cast — Cast list
 * @param {string[]} opts.crew — Crew list
 * @param {string[]} opts.specialThanks
 * @param {number} [opts.duration=10]
 * @returns {Promise<string>}
 */
export async function addCredits(videoPath, outputPath, opts) {
  const { title, cast = [], crew = [], specialThanks = [], duration = 10 } = opts;

  // Build credits text
  const lines = [];
  lines.push(title ?? '');
  lines.push('');
  lines.push('— CAST —');
  lines.push(...cast);
  lines.push('');
  lines.push('— CREW —');
  lines.push(...crew);
  if (specialThanks.length > 0) {
    lines.push('');
    lines.push('— SPECIAL THANKS —');
    lines.push(...specialThanks);
  }
  lines.push('');
  lines.push('Made with CraftMind Studio');

  // Calculate height needed (roughly 60px per line)
  const totalHeight = lines.length * 60 + 1080;

  const creditsText = lines.join('\\n');

  const creditsFile = path.join(path.dirname(outputPath), '_credits.mp4');
  await runFFmpeg([
    '-y',
    '-f', 'lavfi', '-i', `color=c=black:s=1920x1080:d=${duration}`,
    '-vf', `drawtext=text='${creditsText}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-(t/${duration})*${totalHeight}:line_spacing=30`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-t', String(duration),
    creditsFile,
  ]);

  await concatenateClips([videoPath, creditsFile], outputPath);

  try { await fs.unlink(creditsFile); } catch {}

  return outputPath;
}

// ── Aspect Ratio ──────────────────────────────────────────────────────

/**
 * Apply letterboxing to a video for a cinematic aspect ratio.
 *
 * @param {string} videoPath
 * @param {string} outputPath
 * @param {object} [opts]
 * @param {string} [opts.aspectRatio='2.39:1'] — Target aspect ratio
 * @param {number} [opts.width=1920]
 * @param {number} [opts.height=1080]
 * @returns {Promise<string>}
 */
export async function applyLetterbox(videoPath, outputPath, opts = {}) {
  const { aspectRatio = '2.39:1', width = 1920, height = 1080 } = opts;
  const { cropW, cropH } = calculateLetterbox(width, height, aspectRatio);

  await runFFmpeg([
    '-y',
    '-i', videoPath,
    '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,crop=${cropW}:${cropH}:(iw-${cropW})/2:(ih-${cropH})/2,pad=${cropW}:${Math.round(cropW / ASPECT_RATIOS[aspectRatio])}:0:0:color=black`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    outputPath,
  ]);

  return outputPath;
}

// ── Export Formats ────────────────────────────────────────────────────

/**
 * Export a video to the specified format and quality.
 *
 * @param {string} inputPath
 * @param {string} outputPath — Extension determines format (or use config.format)
 * @param {ExportConfig} [config]
 * @returns {Promise<string>}
 */
export async function exportVideo(inputPath, outputPath, config = {}) {
  const quality = QUALITY_PRESETS[config.quality ?? 'standard'];
  const fmt = config.format ?? path.extname(outputPath).slice(1);
  const outWidth = config.width ?? quality.width;
  const outHeight = config.height ?? quality.height;

  const baseArgs = ['-y', '-i', inputPath];

  switch (fmt) {
    case 'webm':
      baseArgs.push(
        '-c:v', 'libvpx-vp9', '-crf', String(quality.crf),
        '-b:v', '0', '-pix_fmt', 'yuv420p',
        '-vf', `scale=${outWidth}:${outHeight}`,
      );
      if (quality.fps > 30) baseArgs.push('-r', String(quality.fps));
      break;

    case 'gif':
      baseArgs.push(
        '-vf', `fps=${Math.min(15, quality.fps)},scale=${Math.min(outWidth, 800)}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      );
      break;

    default: // mp4
      baseArgs.push(
        '-c:v', quality.codec, '-preset', quality.preset, '-crf', String(quality.crf),
        '-pix_fmt', 'yuv420p',
        '-vf', `scale=${outWidth}:${outHeight}`,
      );
      break;
  }

  baseArgs.push(outputPath);
  await runFFmpeg(baseArgs);
  return outputPath;
}

// ── Internal ───────────────────────────────────────────────────────────

/**
 * Concatenate clips (re-exported for convenience).
 */
async function concatenateClips(clipPaths, outputPath) {
  const listFile = path.join(path.dirname(outputPath), '_concat_list.txt');
  const content = clipPaths.map(p => `file '${path.resolve(p)}'`).join('\n');
  await fs.writeFile(listFile, content);

  await runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputPath]);
  await fs.unlink(listFile);
  return outputPath;
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', err => reject(new Error(`ffmpeg error: ${err.message}`)));
  });
}

export { QUALITY_PRESETS, ASPECT_RATIOS, calculateLetterbox };

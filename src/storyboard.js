/**
 * @module storyboard
 * Storyboard Generator — from a creative brief or shot list, generate
 * visual ASCII art panels showing camera angles, character positions, and key action.
 */

import { getStateAt } from './camera.js';

/**
 * @typedef {object} StoryboardPanel
 * @property {number} sceneNumber
 * @property {string} description
 * @property {string} cameraAngle
 * @property {string} asciiArt — Top-down view of the scene
 * @property {string} sideView — Side view showing height/depth
 * @property {string[]} notes — Director's notes for this panel
 */

// ── ASCII Canvas Helpers ──────────────────────────────────────────────

const CANVAS_W = 50;
const CANVAS_H = 25;
const SIDE_W = 50;
const SIDE_H = 20;

function createCanvas(w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) rows.push(new Array(w).fill(' '));
  return { canvas: rows, width: w, height: h };
}

function drawChar(c, x, y, ch) {
  const rows = c.canvas ?? c;
  const w = c.width ?? rows[0]?.length ?? 0;
  const h = c.height ?? rows.length;
  if (x >= 0 && x < w && y >= 0 && y < h) {
    rows[y][x] = ch;
  }
}

function drawLabel(canvas, x, y, text) {
  for (let i = 0; i < text.length && x + i < (canvas.width ?? 0); i++) {
    drawChar(canvas, x + i, y, text[i]);
  }
}

function drawBox(canvas, x1, y1, x2, y2, ch = '─', corner = '+') {
  // Clamp to canvas bounds
  x1 = Math.max(0, x1); y1 = Math.max(0, y1);
  x2 = Math.min(canvas.width - 1, x2); y2 = Math.min(canvas.height - 1, y2);
  for (let x = x1; x <= x2; x++) {
    drawChar(canvas, x, y1, ch);
    drawChar(canvas, x, y2, ch);
  }
  for (let y = y1; y <= y2; y++) {
    drawChar(canvas, x1, y, '│');
    drawChar(canvas, x2, y, '│');
  }
  drawChar(canvas, x1, y1, corner);
  drawChar(canvas, x2, y1, corner);
  drawChar(canvas, x1, y2, corner);
  drawChar(canvas, x2, y2, corner);
}

function renderCanvas(c) {
  const rows = c.canvas ?? c;
  return rows.map(row => row.join('')).join('\n');
}

/**
 * Generate a storyboard panel for a single shot.
 *
 * @param {object} shot — Timeline shot object
 * @param {object[]} [subjects] — Character positions: { id, name, x, z, y }
 * @param {object} [cameraState] — Camera position: { x, y, z, yaw, pitch }
 * @returns {StoryboardPanel}
 */
export function generatePanel(shot, subjects = [], cameraState = null) {
  const notes = [];

  // ── Top-Down View ─────────────────────────────────────────────────
  const top = createCanvas(CANVAS_W, CANVAS_H);
  const centerX = Math.floor(CANVAS_W / 2);
  const centerY = Math.floor(CANVAS_H / 2);

  // Frame border
  drawBox(top, 0, 0, CANVAS_W - 1, CANVAS_H - 1, '─', '+');

  // Rule of thirds grid
  const thirdW = Math.floor(CANVAS_W / 3);
  const thirdH = Math.floor(CANVAS_H / 3);
  for (let i = 1; i <= 2; i++) {
    for (let x = 1; x < CANVAS_W - 1; x++) drawChar(top, x, i * thirdH, '·');
    for (let y = 1; y < CANVAS_H - 1; y++) drawChar(top, i * thirdW, y, '·');
  }

  // Shot type label
  const shotLabel = `[${shot.cameraAngle?.toUpperCase() ?? 'WIDE'}]`;
  drawLabel(top, 2, 1, shotLabel);

  // Scale: map world coordinates to canvas
  // Find bounds of subjects
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of subjects) {
    minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
    minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
  }
  if (cameraState) {
    minX = Math.min(minX, cameraState.x); maxX = Math.max(maxX, cameraState.x);
    minZ = Math.min(minZ, cameraState.z); maxZ = Math.max(maxZ, cameraState.z);
  }
  if (!isFinite(minX)) { minX = 0; maxX = 20; minZ = 0; maxZ = 20; }

  // Add padding
  const padX = Math.max(5, (maxX - minX) * 0.3);
  const padZ = Math.max(5, (maxZ - minZ) * 0.3);
  minX -= padX; maxX += padX; minZ -= padZ; maxZ += padZ;

  function toCanvas(wx, wz) {
    const cx = 2 + Math.floor(((wx - minX) / (maxX - minX)) * (CANVAS_W - 4));
    const cy = 2 + Math.floor(((wz - minZ) / (maxZ - minZ)) * (CANVAS_H - 4));
    return { x: Math.max(1, Math.min(CANVAS_W - 2, cx)), y: Math.max(1, Math.min(CANVAS_H - 2, cy)) };
  }

  // Draw camera
  if (cameraState) {
    const cp = toCanvas(cameraState.x, cameraState.z);
    drawLabel(top, cp.x - 3, cp.y, '📷');
    notes.push(`Camera: (${cameraState.x.toFixed(0)}, ${cameraState.y.toFixed(0)}, ${cameraState.z.toFixed(0)}) yaw=${cameraState.yaw.toFixed(0)}° pitch=${cameraState.pitch.toFixed(0)}°`);
  }

  // Draw subjects
  const subjectSymbols = ['🙂', '😎', '🤖', '👻', '🧙', '🧝', '😈', '🥷', '👶', '👹'];
  for (let i = 0; i < subjects.length; i++) {
    const s = subjects[i];
    const sp = toCanvas(s.x, s.z);
    const sym = subjectSymbols[i % subjectSymbols.length];
    drawLabel(top, sp.x - 1, sp.y - 1, sym);
    drawLabel(top, Math.min(sp.x + 2, CANVAS_W - s.name.length - 2), sp.y - 1, s.name);
  }

  // Draw look direction lines from camera to subjects
  if (cameraState && subjects.length > 0) {
    const cp = toCanvas(cameraState.x, cameraState.z);
    for (const s of subjects) {
      const sp = toCanvas(s.x, s.z);
      drawLine(top, cp.x, cp.y, sp.x, sp.y, '·');
    }
  }

  // Mood label
  drawLabel(top, 2, CANVAS_H - 2, `mood: ${shot.mood ?? 'neutral'}`);
  drawLabel(top, CANVAS_W - 12, CANVAS_H - 2, `t: ${shot.durationSec ?? 5}s`);

  const topView = renderCanvas(top);

  // ── Side View ────────────────────────────────────────────────────
  const side = createCanvas(SIDE_W, SIDE_H);
  drawBox(side, 0, 0, SIDE_W - 1, SIDE_H - 1, '─', '+');

  // Ground line
  const groundY = SIDE_H - 4;
  for (let x = 1; x < SIDE_W - 1; x++) drawChar(side, x, groundY, '▓');

  drawLabel(side, 2, 1, `[SIDE VIEW]`);

  if (subjects.length > 0 && cameraState) {
    // Scale Y to side view
    const allY = [...subjects.map(s => s.y), cameraState.y];
    const minY = Math.min(...allY) - 2;
    const maxY = Math.max(...allY) + 5;

    function toSideX(wx) {
      return 3 + Math.floor(((wx - minX) / (maxX - minX)) * (SIDE_W - 6));
    }
    function toSideY(wy) {
      return 2 + Math.floor(((maxY - wy) / (maxY - minY)) * (groundY - 4));
    }

    // Camera
    const cx = toSideX(cameraState.x);
    const cy = toSideY(cameraState.y);
    drawLabel(side, Math.max(1, cx - 3), Math.max(2, cy - 1), '📷');

    // Subjects
    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i];
      const sx = toSideX(s.x);
      const sy = toSideY(s.y);
      drawLabel(side, Math.max(1, sx - 1), Math.max(2, sy - 1), subjectSymbols[i % subjectSymbols.length]);
      drawLabel(side, Math.max(1, sx - 1), Math.min(SIDE_H - 2, sy), '│');
    }
  }

  const sideView = renderCanvas(side);

  return {
    sceneNumber: shot.sceneNumber ?? 0,
    description: shot.description ?? '',
    cameraAngle: shot.cameraAngle ?? 'wide',
    beat: shot.beat ?? '',
    asciiArt: topView,
    sideView,
    notes: [
      ...notes,
      `Beat: ${shot.beat ?? 'none'}`,
      `Transition: ${shot.transition ?? 'cut'}`,
      ...(shot.dialogueHint ? [`Dialogue: ${shot.dialogueHint}`] : []),
    ],
  };
}

/**
 * Generate a complete storyboard from a timeline.
 *
 * @param {object} timeline — Timeline with shots array
 * @param {object} [opts]
 * @param {object[]} [opts.subjectsByScene] — Map of sceneNumber → subjects array
 * @param {object} [opts.cameraByScene] — Map of sceneNumber → camera state
 * @returns {StoryboardPanel[]}
 */
export function generateStoryboard(timeline, opts = {}) {
  const panels = [];

  for (const shot of timeline.shots) {
    const subjects = opts.subjectsByScene?.[shot.sceneNumber] ?? [];
    const cam = opts.cameraByScene?.[shot.sceneNumber];

    // If camera path exists, get the midpoint
    let cameraState = cam;
    if (!cameraState && shot.cameraPath) {
      const midTime = (shot.cameraPath.keyframes[0]?.timeSec ?? 0) +
        ((shot.cameraPath.keyframes[shot.cameraPath.keyframes.length - 1]?.timeSec ?? 0) -
         (shot.cameraPath.keyframes[0]?.timeSec ?? 0)) / 2;
      cameraState = getStateAt(shot.cameraPath, midTime);
    }

    panels.push(generatePanel(shot, subjects, cameraState));
  }

  return panels;
}

/**
 * Render a storyboard panel as a formatted string suitable for terminal output.
 */
export function renderPanel(panel) {
  const divider = '═'.repeat(CANVAS_W);
  return [
    divider,
    `  SCENE ${panel.sceneNumber}  |  ${panel.cameraAngle.toUpperCase()}  |  Beat: ${panel.beat}`,
    `  "${panel.description}"`,
    divider,
    panel.asciiArt,
    divider,
    panel.sideView,
    divider,
    panel.notes.map(n => `  • ${n}`).join('\n'),
    '',
  ].join('\n');
}

/**
 * Render a full storyboard as a string.
 */
export function renderStoryboard(panels) {
  const header = `🎬 STORYBOARD — ${panels.length} PANELS\n` + '═'.repeat(CANVAS_W);
  return header + '\n\n' + panels.map(renderPanel).join('\n');
}

// ── Bresenham line drawing ────────────────────────────────────────────

function drawLine(canvas, x0, y0, x1, y1, ch) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    drawChar(canvas, x0, y0, ch);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

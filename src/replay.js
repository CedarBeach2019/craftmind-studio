/**
 * @module replay
 * Replay Recording System — captures and stores gameplay events for cinematic analysis.
 * Records player positions, rotations, block changes, and chat messages as JSONL files.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

/**
 * @typedef {'position'|'block'|'chat'|'action'} EventType
 * @typedef {{ timestamp: number, type: EventType, data: object }} ReplayEvent
 */

/**
 * Replay Recorder — captures gameplay events at regular intervals.
 */
export class ReplayRecorder {
  /**
   * @param {object} options
   * @param {string} [options.replayDir='replays'] — Directory to store replays
   * @param {number} [options.recordIntervalMs=50] — Position recording interval (20fps)
   * @param {boolean} [options.autoCompress=true] — Compress replays older than 1 hour
   * @param {number} [options.maxUncompressedAge=3600000] — Max age before compression (1hr)
   */
  constructor(options = {}) {
    this.replayDir = options.replayDir ?? 'replays';
    this.recordIntervalMs = options.recordIntervalMs ?? 50; // 20fps
    this.autoCompress = options.autoCompress ?? true;
    this.maxUncompressedAge = options.maxUncompressedAge ?? 3600000;

    this.isRecording = false;
    this.events = [];
    this.recordingStartTime = 0;
    this.intervalId = null;
    this.replayId = null;
  }

  /**
   * Start recording a new replay session.
   * @param {string} [replayId] — Optional custom replay ID
   * @returns {string} The replay ID
   */
  start(replayId) {
    if (this.isRecording) {
      throw new Error('Already recording. Call stop() first.');
    }

    this.replayId = replayId ?? this._generateReplayId();
    this.events = [];
    this.recordingStartTime = Date.now();
    this.isRecording = true;

    // Start periodic position recording
    this.intervalId = setInterval(() => {
      if (this.isRecording) {
        this._recordTick();
      }
    }, this.recordIntervalMs);

    // Record start event
    this._recordEvent('action', {
      action: 'recording_started',
      timestamp: this.recordingStartTime,
    });

    return this.replayId;
  }

  /**
   * Stop recording and prepare to save.
   * @returns {number} Number of events recorded
   */
  stop() {
    if (!this.isRecording) {
      throw new Error('Not currently recording');
    }

    this.isRecording = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Record stop event
    this._recordEvent('action', {
      action: 'recording_stopped',
      duration: Date.now() - this.recordingStartTime,
      eventCount: this.events.length,
    });

    return this.events.length;
  }

  /**
   * Record a player position update.
   * @param {object} player
   * @param {string} player.id
   * @param {string} player.name
   * @param {object} player.position — { x, y, z, yaw, pitch, onGround }
   */
  recordPlayerPosition(player) {
    if (!this.isRecording) return;

    this._recordEvent('position', {
      playerId: player.id,
      playerName: player.name,
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.position.yaw,
      pitch: player.position.pitch,
      onGround: player.position.onGround ?? true,
      velocity: player.velocity,
    });
  }

  /**
   * Record a block change (place or break).
   * @param {object} blockEvent
   * @param {string} blockEvent.playerId
   * @param {object} blockEvent.position — { x, y, z }
   * @param {string} blockEvent.blockId — Block type placed/broken
   * @param {'place'|'break'} blockEvent.action
   */
  recordBlockChange(blockEvent) {
    if (!this.isRecording) return;

    this._recordEvent('block', {
      playerId: blockEvent.playerId,
      x: blockEvent.position.x,
      y: blockEvent.position.y,
      z: blockEvent.position.z,
      blockId: blockEvent.blockId,
      action: blockEvent.action,
    });
  }

  /**
   * Record a chat message.
   * @param {object} chat
   * @param {string} chat.playerId
   * @param {string} chat.message
   * @param {string} [chat.type='chat'] — Message type
   */
  recordChatMessage(chat) {
    if (!this.isRecording) return;

    this._recordEvent('chat', {
      playerId: chat.playerId,
      message: chat.message,
      type: chat.type ?? 'chat',
    });
  }

  /**
   * Record a gameplay action (jump, attack, interact, etc.).
   * @param {object} action
   * @param {string} action.playerId
   * @param {string} action.actionType — Type of action
   * @param {object} [action.data] — Additional action-specific data
   */
  recordAction(action) {
    if (!this.isRecording) return;

    this._recordEvent('action', {
      playerId: action.playerId,
      action: action.actionType,
      data: action.data ?? {},
    });
  }

  /**
   * Save the current replay to disk as JSONL.
   * @param {string} [filename] — Optional custom filename
   * @returns {Promise<string>} Path to saved replay file
   */
  async save(filename) {
    if (this.isRecording) {
      throw new Error('Cannot save while recording. Call stop() first.');
    }

    const replayId = filename ?? `${this.replayId}.jsonl`;
    const filepath = join(this.replayDir, replayId);

    // Ensure directory exists
    await fs.mkdir(this.replayDir, { recursive: true });

    // Write events as JSONL (one JSON object per line)
    const content = this.events.map(e => JSON.stringify(e)).join('\n');
    await fs.writeFile(filepath, content, 'utf8');

    return filepath;
  }

  /**
   * Load a replay from disk.
   * @param {string} replayId — Replay ID or filename
   * @returns {Promise<ReplayEvent[]>}
   */
  async loadReplay(replayId) {
    const filename = replayId.endsWith('.jsonl') ? replayId : `${replayId}.jsonl`;
    const filepath = join(this.replayDir, filename);

    try {
      const content = await fs.readFile(filepath, 'utf8');
      return content.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Try compressed version
        return this._loadCompressedReplay(replayId);
      }
      throw err;
    }
  }

  /**
   * Get replay metadata without loading all events.
   * @param {string} replayId
   * @returns {Promise<{ eventCount: number, duration: number, startTime: number }>}
   */
  async getReplayMetadata(replayId) {
    const events = await this.loadReplay(replayId);
    if (events.length === 0) {
      return { eventCount: 0, duration: 0, startTime: 0 };
    }

    const startTime = events[0].timestamp;
    const endTime = events[events.length - 1].timestamp;

    return {
      eventCount: events.length,
      duration: endTime - startTime,
      startTime,
    };
  }

  /**
   * List all available replays.
   * @returns {Promise<string[]>} Array of replay IDs
   */
  async listReplays() {
    try {
      const files = await fs.readdir(this.replayDir);
      return files
        .filter(f => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))
        .map(f => f.replace('.jsonl', '').replace('.gz', ''));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /**
   * Compress old replays to save disk space.
   * @param {number} [maxAgeMs] — Override default max age
   * @returns {Promise<number>} Number of replays compressed
   */
  async compressOldReplays(maxAgeMs) {
    if (!this.autoCompress) return 0;

    const ageThreshold = maxAgeMs ?? this.maxUncompressedAge;
    const now = Date.now();
    let compressed = 0;

    const replays = await this.listReplays();
    for (const replayId of replays) {
      const filepath = join(this.replayDir, `${replayId}.jsonl`);
      const compressedPath = `${filepath}.gz`;

      // Skip if already compressed
      try {
        await fs.access(compressedPath);
        continue;
      } catch {
        // Compressed file doesn't exist, proceed
      }

      // Check file age
      const stats = await fs.stat(filepath);
      const age = now - stats.mtimeMs;

      if (age > ageThreshold) {
        await this._compressFile(filepath, compressedPath);
        await fs.unlink(filepath); // Remove uncompressed
        compressed++;
      }
    }

    return compressed;
  }

  /**
   * Delete a replay.
   * @param {string} replayId
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteReplay(replayId) {
    const filepath = join(this.replayDir, `${replayId}.jsonl`);
    const compressedPath = `${filepath}.gz`;

    let deleted = false;
    try {
      await fs.unlink(filepath);
      deleted = true;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    try {
      await fs.unlink(compressedPath);
      deleted = true;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    return deleted;
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  /**
   * Record an event with current timestamp.
   * @private
   */
  _recordEvent(type, data) {
    this.events.push({
      timestamp: Date.now() - this.recordingStartTime,
      type,
      data,
    });
  }

  /**
   * Periodic tick for automatic position recording.
   * @private
   */
  _recordTick() {
    // This is a no-op in the base class.
    // Subclasses or integrations should override or use recordPlayerPosition()
    // with actual player data from the Minecraft server.
  }

  /**
   * Generate a unique replay ID.
   * @private
   */
  _generateReplayId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `replay-${timestamp}-${random}`;
  }

  /**
   * Compress a file using gzip.
   * @private
   */
  async _compressFile(inputPath, outputPath) {
    const readStream = createReadStream(inputPath);
    const writeStream = createWriteStream(outputPath);
    const gzip = createGzip();

    await pipeline(readStream, gzip, writeStream);
  }

  /**
   * Load a compressed replay.
   * @private
   */
  async _loadCompressedReplay(replayId) {
    const filename = replayId.endsWith('.jsonl.gz')
      ? replayId
      : `${replayId}.jsonl.gz`;
    const filepath = join(this.replayDir, filename);

    const { createGunzip } = await import('zlib');
    const { pipeline } = await import('stream/promises');

    const chunks = [];
    const readStream = createReadStream(filepath);
    const gunzip = createGunzip();

    await pipeline(
      readStream,
      gunzip,
      async function* (source) {
        for await (const chunk of source) {
          chunks.push(chunk);
        }
      }
    );

    const content = Buffer.concat(chunks).toString('utf8');
    return content.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  /**
   * Get a subset of replay events within a time range.
   * Useful for extracting specific scenes.
   * @param {string} replayId
   * @param {number} startTimeMs
   * @param {number} endTimeMs
   * @returns {Promise<ReplayEvent[]>}
   */
  async getReplaySegment(replayId, startTimeMs, endTimeMs) {
    const events = await this.loadReplay(replayId);
    return events.filter(e =>
      e.timestamp >= startTimeMs && e.timestamp <= endTimeMs
    );
  }

  /**
   * Export replay in a different format.
   * @param {string} replayId
   * @param {'json'|'csv'} format
   * @returns {Promise<string>}
   */
  async exportReplay(replayId, format = 'json') {
    const events = await this.loadReplay(replayId);

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    } else if (format === 'csv') {
      // Simple CSV export
      const headers = ['timestamp', 'type', 'data'];
      const rows = events.map(e => [
        e.timestamp,
        e.type,
        JSON.stringify(e.data).replace(/"/g, '""'),
      ]);
      return [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${v}"`).join(',')),
      ].join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Create a new replay recorder instance.
 * @param {object} [options]
 * @returns {ReplayRecorder}
 */
export function createReplayRecorder(options) {
  return new ReplayRecorder(options);
}

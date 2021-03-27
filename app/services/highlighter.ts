import { Service } from 'services/core';
import path from 'path';
import execa from 'execa';
import ndarray from 'ndarray';
import createBuffer from 'gl-buffer';
import transitions from 'gl-transitions';
import createTransition from 'gl-transition';
import createTexture from 'gl-texture2d';

const FFMPEG_DIR = path.resolve('../../', 'Downloads', 'ffmpeg', 'bin');
const FFMPEG_EXE = path.join(FFMPEG_DIR, 'ffmpeg.exe');
const FFPROBE_EXE = path.join(FFMPEG_DIR, 'ffprobe.exe');

const CLIP_DIR = path.resolve('../../', 'Videos');
export const CLIP_1 = path.join(CLIP_DIR, '1.mp4');
export const CLIP_2 = path.join(CLIP_DIR, '2.mp4');
export const CLIP_3 = path.join(CLIP_DIR, '3.mp4');
export const CLIP_4 = path.join(CLIP_DIR, 'Facebook Refactor.mov');
const EXPORT_FILE = path.join(CLIP_DIR, 'output.mp4');

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;

// Frames are RGBA, 4 bytes per pixel
const FRAME_BYTE_SIZE = WIDTH * HEIGHT * 4;

export const SCRUB_WIDTH = 320;
export const SCRUB_HEIGHT = 180;
export const SCRUB_FRAMES = 20;
const SCRUB_FRAME_BYTE_SIZE = SCRUB_WIDTH * SCRUB_HEIGHT * 4;

const TRANSITION_DURATION = 1;
const TRANSITION_FRAMES = TRANSITION_DURATION * FPS;

/**
 * Extracts an audio file from a video file
 */
export class AudioSource {
  readonly outPath: string;

  constructor(public readonly sourcePath: string) {
    const parsed = path.parse(this.sourcePath);
    this.outPath = path.join(parsed.dir, `${parsed.name}-audio.flac`);
  }

  async extract() {
    /* eslint-disable */
    const args = [
      '-i', this.sourcePath,
      '-sample_fmt', 's32',
      '-ar', '48000',
      '-map', 'a:0',
      '-c:a', 'flac',
      '-y',
      this.outPath,
    ];
    /* eslint-enable */

    await execa(FFMPEG_EXE, args);
  }
}

export class FrameSource {
  writeBuffer = Buffer.allocUnsafe(FRAME_BYTE_SIZE);
  readBuffer = Buffer.allocUnsafe(FRAME_BYTE_SIZE);
  private byteIndex = 0;

  /**
   * Allocated on demand to save memory
   */
  scrubFrames: Buffer[];

  readonly width = WIDTH;
  readonly height = HEIGHT;

  private ffmpeg: execa.ExecaChildProcess<string>;

  private onFrameComplete: (frameRead: boolean) => void;

  private finished = false;

  currentFrame = 0;

  get nFrames() {
    // Not sure why last frame is sometimes missing
    return Math.floor(this.duration * FPS) - 1;
  }

  constructor(public readonly sourcePath: string, public readonly duration: number) {}

  private allocScrubbingFrames() {
    if (this.scrubFrames) {
      console.log('Scrub frames already allocated');
      return;
    }

    this.scrubFrames = Array(SCRUB_FRAMES)
      .fill(0)
      .map(() => {
        return Buffer.allocUnsafe(SCRUB_FRAME_BYTE_SIZE);
      });
  }

  async readScrubbingFrames() {
    this.allocScrubbingFrames();

    await Promise.all(
      this.scrubFrames.map((f, idx) => {
        return this.readScrubbingFrame(idx);
      }),
    );
  }

  private async readScrubbingFrame(idx: number) {
    /* eslint-disable */
    const args = [
      '-ss', `${this.duration / SCRUB_FRAMES * idx * 1000}ms`,
      '-i', this.sourcePath,
      '-vf', `scale=${SCRUB_WIDTH}:${SCRUB_HEIGHT}`,
      '-frames:v', '1',
      '-vcodec', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-f', 'image2pipe',
      '-'
    ];
    /* eslint-enable */

    let byteIdx = 0;

    const ffmpeg = execa(FFMPEG_EXE, args, {
      encoding: null,
      buffer: false,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: process.stderr,
    });

    return new Promise<void>(resolve => {
      ffmpeg.stdout.once('end', () => {
        console.log('FFMPEG SEEK ENDED', byteIdx, SCRUB_FRAME_BYTE_SIZE);
        resolve();
      });

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        console.log('GOT CHUNK', chunk);
        chunk.copy(this.scrubFrames[idx], byteIdx, 0);
        byteIdx += chunk.length;
      });
    });
  }

  private startFfmpeg() {
    /* eslint-disable */
    const args = [
      '-i', this.sourcePath,
      '-vf', `fps=${FPS},scale=${this.width}:${this.height}`,
      '-map', 'v:0',
      '-vcodec', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-f', 'image2pipe',
      '-'
    ];
    /* eslint-enable */

    console.log(args);

    this.ffmpeg = execa(FFMPEG_EXE, args, {
      encoding: null,
      buffer: false,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: process.stderr,
    });

    this.ffmpeg.stdout.once('end', () => {
      console.log('STREAM HAS ENDED');
      this.finished = true;

      // If a frame request is in progress, immediately resolve it
      if (this.onFrameComplete) this.onFrameComplete(false);
    });

    this.ffmpeg.stdout.on('data', (chunk: Buffer) => {
      // console.log('GOT CHUNK LENGTH', chunk.length);

      this.handleChunk(chunk);
    });

    this.ffmpeg.stdout.on('error', e => {
      console.log('error', e);
    });
  }

  /**
   * Attempts to read another frame into the readBuffer
   * @returns Returns true if a frame was read, otherwise false
   */
  readNextFrame(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      if (!this.ffmpeg) this.startFfmpeg();

      if (this.onFrameComplete) {
        console.log('Cannot read next frame while frame read is in progress');
        resolve(false);
        return;
      }

      // The stream was closed, so resolve that a frame could not be read.
      if (this.finished) {
        resolve(false);
        return;
      }

      this.onFrameComplete = resolve;

      this.ffmpeg.stdout.resume();
    });
  }

  private handleChunk(chunk: Buffer) {
    // If the chunk is larger than what's needed to fill the rest of the frame buffer,
    // only copy enough to fill the buffer.
    const bytesToCopy =
      this.byteIndex + chunk.length > FRAME_BYTE_SIZE
        ? FRAME_BYTE_SIZE - this.byteIndex
        : chunk.length;

    chunk.copy(this.writeBuffer, this.byteIndex, 0, bytesToCopy);
    this.byteIndex += bytesToCopy;

    if (this.byteIndex >= FRAME_BYTE_SIZE) {
      this.ffmpeg.stdout.pause();

      console.log('FRAME BUFFER IS FILLED');
      this.swapBuffers();

      this.currentFrame++;
      this.onFrameComplete(true);
      this.onFrameComplete = null;

      const remainingBytes = chunk.length - bytesToCopy;

      if (remainingBytes > 0) {
        chunk.copy(this.writeBuffer, this.byteIndex, bytesToCopy);
        this.byteIndex += remainingBytes;
      }
    }
  }

  /**
   * Swaps read and write buffers (front/back buffer)
   */
  private swapBuffers() {
    const newRead = this.writeBuffer;
    this.writeBuffer = this.readBuffer;
    this.readBuffer = newRead;
    this.byteIndex = 0;
  }
}

export class Clip {
  frameSource: FrameSource;
  audioSource: AudioSource;

  duration: number;

  constructor(public readonly sourcePath: string) {}

  async init() {
    await this.readDuration();
    this.frameSource = new FrameSource(this.sourcePath, this.duration);
    this.audioSource = new AudioSource(this.sourcePath);
  }

  private async readDuration() {
    if (this.duration) return;

    const { stdout } = await execa(FFPROBE_EXE, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      this.sourcePath,
    ]);
    this.duration = parseFloat(stdout);
  }
}

export class FrameWriter {
  constructor(public readonly outputPath: string) {}

  readonly width = WIDTH;
  readonly height = HEIGHT;

  private ffmpeg: execa.ExecaChildProcess<string>;

  private startFfmpeg() {
    /* eslint-disable */
    const args = [
      '-f', 'rawvideo',
      '-vcodec', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${this.width}x${this.height}`,
      '-r', `${FPS}`,
      '-i', '-',
      '-vf', 'format=yuv420p',
      '-vcodec', 'libx264',
      '-profile:v', 'high',
      '-preset:v', 'ultrafast',
      '-crf', '18',
      '-movflags', 'faststart',
      '-y', this.outputPath,
    ];
    /* eslint-enable */

    console.log(args);

    this.ffmpeg = execa(FFMPEG_EXE, args, {
      encoding: null,
      buffer: false,
      stdin: 'pipe',
      stdout: process.stdout,
      stderr: 'pipe',
    });

    this.ffmpeg.on('exit', code => {
      console.log('ffmpeg writer exited with code', code);
    });

    this.ffmpeg.catch(e => {
      console.log('CAUGHT ERROR', e);
    });

    this.ffmpeg.stderr.on('data', (data: Buffer) => {
      console.log('ffmpeg stderr:', data.toString());
    });
  }

  async writeNextFrame(frameBuffer: Buffer) {
    if (!this.ffmpeg) this.startFfmpeg();

    await new Promise<void>(resolve => {
      this.ffmpeg.stdin.write(frameBuffer, e => {
        if (e) console.log(e);
        resolve();
      });
    });
  }

  end() {
    this.ffmpeg.stdin.end();
  }
}

export class Compositor2D {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d');

  readonly width = WIDTH;
  readonly height = HEIGHT;

  constructor() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  drawFrame(frame: Buffer) {
    const data = new ImageData(Uint8ClampedArray.from(frame), this.width, this.height);
    this.ctx.putImageData(data, 0, 0);
  }

  drawText() {
    this.ctx.font = '48px sans-serif';
    this.ctx.fillText('Hello World', 50, 50);
  }

  getFrame(): Buffer {
    return Buffer.from(this.ctx.getImageData(0, 0, this.width, this.height).data);
  }
}

export class Transitioner {
  private canvas = document.createElement('canvas');
  private gl = this.canvas.getContext('webgl');

  readonly width = WIDTH;
  readonly height = HEIGHT;

  private readBuffer = Buffer.allocUnsafe(FRAME_BYTE_SIZE);

  constructor() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }

  renderTransition(fromFrame: Buffer, toFrame: Buffer, progress: number) {
    const buffer = createBuffer(
      this.gl,
      [-1, -1, -1, 4, 4, -1],
      this.gl.ARRAY_BUFFER,
      this.gl.STATIC_DRAW,
    );

    const transitionSrc = transitions.find((t: any) => t.name === 'wind');
    const transition = createTransition(this.gl, transitionSrc);

    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    const fromArray = this.convertFrame(fromFrame);
    const fromTexture = createTexture(this.gl, fromArray);
    fromTexture.minFilter = this.gl.LINEAR;
    fromTexture.magFilter = this.gl.LINEAR;

    const toArray = this.convertFrame(toFrame);
    const toTexture = createTexture(this.gl, toArray);
    fromTexture.minFilter = this.gl.LINEAR;
    fromTexture.magFilter = this.gl.LINEAR;

    buffer.bind();
    console.log('draw progress', progress);
    transition.draw(
      progress,
      fromTexture,
      toTexture,
      this.gl.drawingBufferWidth,
      this.gl.drawingBufferHeight,
    );

    fromTexture.dispose();
    toTexture.dispose();
  }

  getFrame(): Buffer {
    this.gl.readPixels(
      0,
      0,
      this.width,
      this.height,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      this.readBuffer,
    );

    return this.readBuffer;
  }

  private convertFrame(frame: Buffer) {
    return ndarray(frame, [this.width, this.height, 4], [4, this.width * 4, 1]);
  }
}

export class HighlighterService extends Service {
  async run() {
    const clips = [new Clip(CLIP_1), new Clip(CLIP_2), new Clip(CLIP_3), new Clip(CLIP_4)];

    // Read all durations
    // TODO: pMap
    await Promise.all(clips.map(s => s.init()));

    let fromClip = clips.shift();
    let toClip = clips.shift();

    const transitioner = new Transitioner();

    const writer = new FrameWriter(EXPORT_FILE);

    // const compositor = new Compositor2D();

    // console.log('DURATION', source.duration);
    // console.log('ESTIMATED FRAMES', source.duration * FPS);

    let frameCounter = 0;

    while (true) {
      console.log('Reading from frame');
      const fromFrameRead = await fromClip.frameSource.readNextFrame();
      const inTransition = fromClip.frameSource.currentFrame >= fromClip.frameSource.nFrames - TRANSITION_FRAMES;
      let frameToRender = fromSource.readBuffer;

      if (inTransition && toSource) {
        await toSource.readNextFrame();

        transitioner.renderTransition(
          fromSource.readBuffer,
          toSource.readBuffer,
          toSource.currentFrame / TRANSITION_FRAMES,
        );
        frameToRender = transitioner.getFrame();

        console.log(fromSource.currentFrame, fromSource.nFrames);
        const transitionEnded = fromSource.currentFrame === fromSource.nFrames;

        if (transitionEnded) {
          console.log('TRANSITION ENDED', sources);
          fromSource = toSource;
          toSource = sources.shift();
        }
      }

      if (fromFrameRead) {
        console.log('Writing frame', frameCounter);

        // transitioner.renderTransition(source.readBuffer, source.readBuffer, 0.5);

        // compositor.drawFrame(source.readBuffer);
        // compositor.drawText();

        await writer.writeNextFrame(frameToRender);
      } else {
        console.log('Out of sources, closing file');
        writer.end();
        break;
      }

      frameCounter++;
    }
  }
}

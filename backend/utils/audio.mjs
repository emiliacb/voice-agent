import { promises as fs } from "fs";
import { spawn } from 'child_process';
import { Log } from "./logger.mjs";

/**
 * Converts an audio buffer to WAV format using FFmpeg
 * @param {Buffer} inputBuffer - The input audio buffer
 * @returns {Promise<Buffer>} The converted WAV buffer
 */
export async function convertToWav(inputBuffer) {
  const timestamp = Date.now();
  const inputPath = `/tmp/input-${timestamp}`;
  const outputPath = `/tmp/output-${timestamp}.wav`;

  // Write the input buffer to a temporary file
  await fs.writeFile(inputPath, inputBuffer);

  try {
    // Convert to WAV using FFmpeg
    const ffmpegProc = spawn('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      outputPath
    ]);

    let ffmpegError = '';
    ffmpegProc.stderr.on('data', (data) => {
      ffmpegError += data.toString();
      Log.info(`FFmpeg: ${data.toString().trim()}`);
    });

    await new Promise((resolve, reject) => {
      ffmpegProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg failed with code ${code}: ${ffmpegError}`));
      });
      ffmpegProc.on('error', reject);
    });

    // Read the converted WAV file
    const wavBuffer = await fs.readFile(outputPath);
    
    // Cleanup temp files
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    return wavBuffer;
  } catch (error) {
    // Cleanup on error
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    throw error;
  }
} 
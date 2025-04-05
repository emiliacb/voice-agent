import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { Log } from '../utils/logger.mjs';

export async function processAudioWithRhubarb(audioFile) {
  const buffer = Buffer.from(await audioFile.arrayBuffer());
  const contentType = audioFile.type;

  // Generate unique file paths
  const timestamp = Date.now();
  const originalPath = `/tmp/original-${timestamp}`;
  const inputPath = `/tmp/input-${timestamp}.wav`;
  const outputPath = `/tmp/output-${timestamp}.json`;

  // Write the original file
  await fs.writeFile(originalPath, buffer);

  Log.info(`Processing audio file of type: ${contentType}`);

  try {
    // Convert to WAV using FFmpeg if the file is WebM
    if (contentType.startsWith('audio/webm')) {
      await convertToWav(originalPath, inputPath);
      await verifyAudioFormat(inputPath);
    } else {
      // If it's already a WAV file, just copy it
      Log.info('Copying WAV file directly...');
      await fs.copyFile(originalPath, inputPath);
    }

    // Cleanup original file
    await fs.unlink(originalPath);
    
    // Process with Rhubarb
    const result = await runRhubarb(inputPath, outputPath);

    // Cleanup temp files
    await fs.unlink(inputPath);
    await fs.unlink(outputPath);

    return result;
  } catch (error) {
    // Cleanup any remaining temp files
    try {
      await fs.unlink(originalPath).catch(() => {});
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    } catch (cleanupError) {
      Log.error(`Error during cleanup: ${cleanupError}`);
    }
    throw error;
  }
}

async function convertToWav(inputPath, outputPath) {
  Log.info('Converting WebM to WAV...');
  const ffmpegProc = spawn('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vn',
    '-c:a', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-f', 'wav',
    '-rf64', 'auto',
    outputPath
  ]);

  let ffmpegStderr = '';
  ffmpegProc.stderr.on('data', (data) => {
    ffmpegStderr += data.toString();
    Log.info(`FFmpeg: ${data.toString().trim()}`);
  });

  await new Promise((resolve, reject) => {
    ffmpegProc.on('close', (code) => {
      if (code === 0) {
        Log.info('FFmpeg conversion completed successfully');
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}. Error: ${ffmpegStderr}`));
      }
    });
    ffmpegProc.on('error', reject);
  });
}

async function verifyAudioFormat(filePath) {
  const ffprobeProc = spawn('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_name,codec_type,sample_rate,channels',
    '-of', 'default=noprint_wrappers=1',
    filePath
  ]);

  let ffprobeOutput = '';
  ffprobeProc.stdout.on('data', (data) => {
    ffprobeOutput += data.toString();
  });

  await new Promise((resolve, reject) => {
    ffprobeProc.on('close', (code) => {
      if (code === 0) {
        Log.info(`FFprobe output: ${ffprobeOutput}`);
        resolve();
      } else {
        reject(new Error(`FFprobe failed with code ${code}`));
      }
    });
  });
}

async function runRhubarb(inputPath, outputPath) {
  Log.info('Starting Rhubarb processing...');
  
  const proc = spawn('rhubarb', [
    inputPath,
    '-o', outputPath,
    '--exportFormat', 'json',
    '--recognizer', 'phonetic',
    '--machineReadable',
    '--quiet'
  ]);

  let stderr = '';
  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  await new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}. Error: ${stderr}`));
    });
    proc.on('error', reject);
  });

  const resultText = await fs.readFile(outputPath, 'utf-8');
  const result = JSON.parse(resultText);
  
  Log.info(`Result: ${result}`);
  return result;
} 
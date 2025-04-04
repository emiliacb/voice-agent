import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { cors } from 'hono/cors';

const app = new Hono();

// Get allowed origins from environment or use defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : 
  ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

// Enable CORS with specific configuration
app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true
}));

app.post('/lipsync', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');
    
    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    
    // Get the content type of the uploaded file
    const contentType = audioFile.type;
    
    // Generate unique file paths
    const timestamp = Date.now();
    const originalPath = `/tmp/original-${timestamp}`;
    const inputPath = `/tmp/input-${timestamp}.wav`;
    const outputPath = `/tmp/output-${timestamp}.json`;
    
    // Write the original file
    await fs.writeFile(originalPath, buffer);
    
    // Convert to WAV if not already WAV format
    if (!contentType.includes('audio/wav') && !contentType.includes('audio/x-wav')) {
      // Use ffmpeg to convert to WAV
      const ffmpeg = spawn('ffmpeg', [
        '-i', originalPath,
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '1',
        '-y', // Overwrite output file if exists
        inputPath
      ]);
      
      let ffmpegError = '';
      ffmpeg.stderr.on('data', (data) => {
        ffmpegError += data.toString();
      });
      
      // Wait for ffmpeg conversion
      await new Promise((resolve, reject) => {
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg conversion failed with code ${code}. Error: ${ffmpegError}`));
        });
        ffmpeg.on('error', reject);
      });
      
      // Clean up original file after conversion
      await fs.unlink(originalPath);
    } else {
      // If it's already WAV, just move the buffer to input path
      await fs.writeFile(inputPath, buffer);
    }

    // Run Rhubarb using child_process with performance optimizations
    const proc = spawn('rhubarb', [
      inputPath,
      '-o', outputPath,
      '--exportFormat', 'json',
      '--recognizer', 'phonetic',
      '--machineReadable',
      '--quiet'
    ]);
    
    // Capture stderr for better error reporting
    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Wait for the process to complete
    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Process exited with code ${code}. Error: ${stderr}`));
      });
      proc.on('error', reject);
    });

    // Read the output JSON
    const resultText = await fs.readFile(outputPath, 'utf-8');
    const result = JSON.parse(resultText);

    // Cleanup temp files
    await fs.unlink(inputPath);
    await fs.unlink(outputPath);

    return c.json(result);
  } catch (error) {
    console.error('Lip sync error:', error);
    return c.json({ 
      error: 'Failed to process audio',
      details: error.message 
    }, 500);
  }
});

// Start the server
const port = process.env.PORT || 3000;
console.log(`Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port
});

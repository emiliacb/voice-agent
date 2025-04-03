import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { cors } from 'hono/cors';

const app = new Hono();

// Enable CORS with specific configuration
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
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
    
    // Since we're in Docker, we can directly use the rhubarb binary
    const inputPath = `/tmp/input-${Date.now()}.wav`;
    const outputPath = `/tmp/output-${Date.now()}.json`;
    
    // Use Node's fs promises to write file
    await fs.writeFile(inputPath, buffer);

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
const port = 3000;
serve({
  fetch: app.fetch,
  port
});

console.log(`Server is running on port ${port}`);


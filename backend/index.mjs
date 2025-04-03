import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';

const app = new Hono();

app.post('/lipsync', async (c) => {
  try {
    // Assuming audio file is sent in request body
    const audioData = await c.req.arrayBuffer();
    const buffer = Buffer.from(audioData);
    
    // Since we're in Docker, we can directly use the rhubarb binary
    const inputPath = `/tmp/input-${Date.now()}.wav`;
    const outputPath = `/tmp/output-${Date.now()}.json`;
    
    // Use Node's fs promises to write file
    await fs.writeFile(inputPath, buffer);

    // Run Rhubarb using child_process
    const proc = spawn('rhubarb', [inputPath, '-o', outputPath]);
    
    // Wait for the process to complete
    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Process exited with code ${code}`));
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
    return c.json({ error: 'Failed to process audio' }, 500);
  }
});

// Start the server
const port = 3000;
serve({
  fetch: app.fetch,
  port
});

console.log(`Server is running on port ${port}`);


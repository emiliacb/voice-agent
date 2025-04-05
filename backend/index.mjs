import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { Log } from './utils/logger.mjs';
import { processAudioWithRhubarb } from './services/rhubarb.mjs';

const app = new Hono();

app.use('*', cors({
  origin: '*',
}));

app.use("*", async (c, next) => {
  Log.info(`${c.req.method} ${c.req.url}`);
  await next();
})

app.post('/rhubarb', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');
    
    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    const result = await processAudioWithRhubarb(audioFile);
    return c.json(result);
  } catch (error) {
    Log.error(`Lip sync error: ${error}`);
    return c.json({ 
      error: 'Failed to process audio',
      details: error.message 
    }, 500);
  }
});

// Start the server
const port = process.env.PORT || 3000;

Log.info(`Server started on port ${port}`);

serve({
  fetch: app.fetch,
  port
});

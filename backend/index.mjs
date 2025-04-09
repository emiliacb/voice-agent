import { config } from 'dotenv';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { RateLimiterMemory } from "rate-limiter-flexible";

import { Log } from './utils/logger.mjs';
import { convertToWav } from './utils/audio.mjs';
import { processAudioWithRhubarb } from './services/rhubarb.mjs';
import { transcribeAudioOpenAI } from './services/speech-to-text.mjs';
import { generateLLMResponse } from './services/llm.mjs';
import { generateAudioFromText } from './services/text-to-speech.mjs';

config();

const app = new Hono();

const ipLimiter = new RateLimiterMemory({
  points: 15,
  duration: 3 * 60 * 60, // 3 hours
});

const routeLimiter = new RateLimiterMemory({
  points: 100,
  duration: 1 * 60 * 60, // 1 hour
});

app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true,
}));

app.use("*", async (c, next) => {
  Log.info(JSON.stringify({
    method: c.req.method,
    url: c.req.url,
    ip: c.req.ip,
    userAgent: c.req.header('User-Agent'),
    origin: c.req.header('Origin')
  }, null, 2));
  await next();
})

app.use("*", async (c, next) => {
  try {
    await ipLimiter.consume(c.req.ip);
    await routeLimiter.consume(c.req.url);
    await next();
  } catch (error) {
    return c.json({ error: 'Too many requests' }, 429);
  }
});

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

app.post('/message', async (c) => {
  try {
    const currentLanguage = c.req.query('lang');
    const formData = await c.req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    // Convert input audio to WAV
    const inputBuffer = Buffer.from(await audioFile.arrayBuffer());
    const wavBuffer = await convertToWav(inputBuffer);
    const wavFile = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' });

    // Transcribe audio
    const transcriptionResult = await transcribeAudioOpenAI(wavFile);

    // Generate LLM response
    const llmResult = await generateLLMResponse(transcriptionResult.transcription, currentLanguage);

    // Generate audio from LLM response
    const responseAudioBuffer = await generateAudioFromText(llmResult);

    // Process response audio with Rhubarb
    const rhubarbResult = await processAudioWithRhubarb(responseAudioBuffer);
    
    return c.json({
      audio: responseAudioBuffer.toString('base64'),
      mouthCues: rhubarbResult.mouthCues
    });
  } catch (error) {
    Log.error(`Processing error: ${error}`);
    return c.json({ 
      error: 'Failed to process audio',
      details: error.message 
    }, 500);
  }
});

const port = process.env.PORT || 3000;

serve({
  fetch: app.fetch,
  port,
});

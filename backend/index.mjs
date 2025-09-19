import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { RateLimiterMemory } from "rate-limiter-flexible";

import { Log } from "./utils/logger.mjs";
import {
  createVisemesWithRhubarb,
  wakeUpRhubarbModel,
} from "./services/rhubarb.mjs";
import { transcribeAudioReplicate } from "./services/speech-to-text.mjs";
import { generateLLMResponseStreamWithRetry } from "./services/llm.mjs";
import { generateAudioFromTextReplicate } from "./services/text-to-speech.mjs";

config();

const app = new Hono();

const ipLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 60,
});

const routeLimiter = new RateLimiterMemory({
  points: 20,
  duration: 60,
});

app.use(
  "*",
  cors({
    origin: process.env.ALLOWED_ORIGINS.split(","),
    credentials: true,
  })
);

app.use("*", async (c, next) => {
  Log.info(
    JSON.stringify(
      {
        method: c.req.method,
        url: c.req.url,
        ip: c.req.ip,
        userAgent: c.req.header("User-Agent"),
        origin: c.req.header("Origin"),
      },
      null,
      2
    )
  );
  await next();
});

app.get("/health", async (c) => {
  await wakeUpRhubarbModel();
  Log.info("Rhubarb model woken up successfully");
  return c.text("OK");
});

app.post("/message", async (c) => {
  try {
    // Rate limit
    await ipLimiter.consume(c.req.ip);
    await routeLimiter.consume(c.req.url);

    const formData = await c.req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile) {
      return c.json({ error: "No audio file provided" }, 400);
    }

    // Transcribe audio
    const transcriptionResult = await transcribeAudioReplicate(audioFile);

    // Create a custom stream that handles both text and audio chunks
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let accumulatedText = "";
          let totalAudioOffset = 0; // Track cumulative audio duration
          let allMouthCues = []; // Collect all mouth cues for final synchronization
          
          // Generate LLM response stream
          for await (const chunk of generateLLMResponseStreamWithRetry(
            transcriptionResult.transcription
          )) {
            accumulatedText += chunk;
            
            // Send text chunk
            controller.enqueue(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
            
            // Generate audio from this chunk
            const responseAudioBuffer = await generateAudioFromTextReplicate(chunk);
            
            // Process response audio with Rhubarb
            const rhubarbResult = await createVisemesWithRhubarb(responseAudioBuffer);
            
            // Adjust mouth cues timestamps to be absolute from the start
            const adjustedMouthCues = rhubarbResult.mouthCues.map(cue => ({
              ...cue,
              start: cue.start + totalAudioOffset,
              end: cue.end + totalAudioOffset
            }));
            
            // Update total offset for next chunk
            if (rhubarbResult.mouthCues.length > 0) {
              totalAudioOffset += rhubarbResult.mouthCues[rhubarbResult.mouthCues.length - 1].end;
            }
            
            // Collect mouth cues for final response
            allMouthCues.push(...adjustedMouthCues);
            
            // Send audio chunk
            controller.enqueue(`data: ${JSON.stringify({ 
              type: 'audio', 
              audio: responseAudioBuffer.toString("base64"),
              mouthCues: adjustedMouthCues 
            })}\n\n`);
          }
          
          // Send completion signal with all mouth cues properly synchronized
          controller.enqueue(`data: ${JSON.stringify({ 
            type: 'complete',
            allMouthCues: allMouthCues
          })}\n\n`);
          controller.close();
        } catch (error) {
          Log.error(`Streaming error: ${error}`);
          controller.enqueue(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  } catch (error) {
    Log.error(`Processing error: ${error}`);
    return c.json(
      {
        error: "Failed to process audio",
        details: error.message,
      },
      500
    );
  }
});

const port = process.env.PORT || 3000;

serve(
  {
    fetch: app.fetch,
    port,
  },
  () => Log.info(`Listening at ${port}`)
);

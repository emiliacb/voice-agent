import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { RateLimiterMemory } from "rate-limiter-flexible";

import { Log } from "./utils/logger.mjs";
import { convertToWav } from "./utils/audio.mjs";
import { processAudioWithRhubarb } from "./services/rhubarb.mjs";
import { transcribeAudioReplicate } from "./services/speech-to-text.mjs";
import { generateLLMResponse } from "./services/llm.mjs";
import { generateAudioFromTextGemini } from "./services/text-to-speech.mjs";

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

    // Convert input audio to WAV
    const inputBuffer = Buffer.from(await audioFile.arrayBuffer());
    const wavBuffer = await convertToWav(inputBuffer);
    const wavFile = new File([wavBuffer], "audio.wav", { type: "audio/wav" });

    // Transcribe audio
    const transcriptionResult = await transcribeAudioReplicate(wavFile);

    // Generate LLM response
    let llmResult;
    try {
      llmResult = await generateLLMResponse(
        transcriptionResult.transcription,
        transcriptionResult.detected_language,
      );
    } catch(err) {
      Log.error(err)
      llmResult = await generateLLMResponse(
        transcriptionResult.transcription,
        transcriptionResult.detected_language,
        true
      );
    }

    // Generate audio from LLM response
    let responseAudioBuffer
    try {
      responseAudioBuffer = await generateAudioFromTextGemini(llmResult);
    } catch(err) {
      Log.error(err)
      responseAudioBuffer = await generateAudioFromTextGemini(llmResult, true);
    }

    // Process response audio with Rhubarb
    const rhubarbResult = await processAudioWithRhubarb(responseAudioBuffer);

    return c.json({
      audio: responseAudioBuffer.toString("base64"),
      mouthCues: rhubarbResult.mouthCues,
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

serve({
  fetch: app.fetch,
  port,
});

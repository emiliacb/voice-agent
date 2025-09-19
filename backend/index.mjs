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

    let finalResult = [];

    // Generate LLM response
    for await (const chunk of generateLLMResponseStreamWithRetry(
      transcriptionResult.transcription
    )) {
      // Generate audio from LLM response
      let responseAudioBuffer = await generateAudioFromTextReplicate(chunk);

      // Process response audio with Rhubarb
      const rhubarbResult = await createVisemesWithRhubarb(responseAudioBuffer);

      finalResult.push({
        audio: responseAudioBuffer,
        mouthCues: rhubarbResult.mouthCues,
      })
    }

    // Join all audio buffers and mouth cues from finalResult
    const finalResponseAudioBuffer = Buffer.concat(finalResult.map(r => r.audio));
    const finalRhubarbResult = {
      mouthCues: (() => {
        let offset = 0;
        const cues = [];
        for (const r of finalResult) {
          for (const cue of r.mouthCues || []) {
            cues.push({
              ...cue,
              start: cue.start + offset,
              end: cue.end + offset,
            });
          }
          // Update offset to the end of the last cue in this chunk
          if (r.mouthCues && r.mouthCues.length > 0) {
            offset += r.mouthCues[r.mouthCues.length - 1].end;
          }
        }
        return cues;
      })()
    };

    return c.json({
      audio: finalResponseAudioBuffer.toString("base64"),
      mouthCues: finalRhubarbResult.mouthCues,
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

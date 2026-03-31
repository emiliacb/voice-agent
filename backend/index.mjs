import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { RateLimiterMemory } from "rate-limiter-flexible";

import { Log } from "./utils/logger.mjs";
import { createVisemesWithRhubarb, wakeUpRhubarbModel } from "./services/rhubarb.mjs";
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
  await wakeUpRhubarbModel()
  Log.info("Rhubarb model woken up successfully");
  return c.text("OK");
});

app.post("/message", async (c) => {
  try {
    await ipLimiter.consume(c.req.ip);
    await routeLimiter.consume(c.req.url);

    const formData = await c.req.formData();
    const audioFile = formData.get("audio");
    const chatHistoryRaw = formData.get("chatHistory");
    const chatHistory = chatHistoryRaw ? JSON.parse(chatHistoryRaw) : [];

    if (!audioFile) return c.json({ error: "No audio file provided" }, 400);

    const transcriptionResult = await transcribeAudioReplicate(audioFile);

    return new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (event, data) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
            send("transcription", { text: transcriptionResult.transcription });

            const result = await generateLLMResponseStreamWithRetry(
              transcriptionResult.transcription,
              chatHistory
            );

            let fullText = "";
            for await (const chunk of result.textStream) {
              fullText += chunk;
              send("text-delta", { delta: chunk });
            }

            send("synthesizing", {});

            const responseAudioBuffer = await generateAudioFromTextReplicate(fullText);
            const rhubarbResult = await createVisemesWithRhubarb(responseAudioBuffer);

            send("audio", {
              audio: responseAudioBuffer.toString("base64"),
              mouthCues: rhubarbResult.mouthCues,
            });

            send("done", {});
            controller.close();
          } catch (error) {
            Log.error(`SSE processing error: ${error}`);
            send("error", { error: "Failed to process audio", details: error.message });
            controller.close();
          }
        }
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      }
    );
  } catch (error) {
    Log.error(`Processing error: ${error}`);
    return c.json({ error: "Failed to process audio", details: error.message }, 500);
  }
});

const port = process.env.PORT || 3000;

serve({
  fetch: app.fetch,
  port,
}, () => Log.info(`Listening at ${port}`));

import OpenAI from "openai";
import Replicate from "replicate";

import { Log } from "../utils/logger.mjs";

const WHISPER_MODEL =
  "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c";

export async function transcribeAudioReplicate(audioFile) {
  const buffer = Buffer.from(await audioFile.arrayBuffer());

  Log.info("Starting audio transcription...");

  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const base64Audio = buffer.toString("base64");

    const output = await replicate.run(WHISPER_MODEL, {
      input: {
        audio: `data:audio/wav;base64,${base64Audio}`,
        transcription: "plain text",
        batch_size: 64,
        language: "None",
      },
    });

    Log.info(`Transcription completed successfully: ${output?.text}`);
    return { transcription: output.text };
  } catch (error) {
    Log.error(`Whisper transcription failed: ${error}`);
    throw error;
  }
}

export async function transcribeAudioOpenAI(audioFile) {
  if (!audioFile) {
    throw new Error("No audio file provided");
  }

  Log.info("Starting audio transcription...");

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    Log.info("Transcription completed successfully");
    return { transcription: transcription.text };
  } catch (error) {
    Log.error(`OpenAI transcription failed: ${error}`);
    throw error;
  }
}

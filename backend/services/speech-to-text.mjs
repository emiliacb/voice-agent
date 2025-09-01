import OpenAI from "openai";
import Replicate from "replicate";

import { Log } from "../utils/logger.mjs";

const WHISPER_MODEL = "openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e";

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
        language: "auto",
        translate: false,
      },
    });

    Log.info("Transcription completed successfully");
    return { transcription: output.transcription };
  } catch (error) {
    Log.error(`Whisper transcription failed: ${error}`);
    throw error;
  }
}

export async function transcribeAudioOpenAI(audioFile) {
  if (!audioFile) {
    throw new Error('No audio file provided');
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

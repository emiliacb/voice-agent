import OpenAI from "openai";
import Replicate from "replicate";

import { Log } from "../utils/logger.mjs";

const TTS_MODEL = "minimax/speech-02-turbo";

export async function generateAudioFromTextReplicate(text, detectedLanguage) {
  if (!text) {
    throw new Error("No text provided");
  }

  Log.info(
    `Generating audio with Replicate for text: "${text.substring(0, 30)}..."`
  );

  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const output = await replicate.run(TTS_MODEL, {
      input: {
        text: text,
        voice_id: "Deep_Voice_Man",
        language_boost: detectedLanguage === "en" ? "English" : "Automatic",
      },
    });

    // The output can be a URL or an array of URLs depending on the model
    let audioUrl = Array.isArray(output) ? output[0] : output;
    if (!audioUrl) {
      throw new Error("No audio URL received from Replicate");
    }

    console.log({audioUrl})

    // Download the audio and return it as a Buffer
    const res = await fetch(audioUrl);
    if (!res.ok) {
      throw new Error(`Error downloading audio: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer || buffer.length === 0) {
      throw new Error("Generated audio buffer is empty");
    }

    Log.info(`Audio generated successfully (${buffer.length} bytes)`);

    return buffer;
  } catch (error) {
    Log.error(`Audio generation with Replicate failed: ${error.message}`);
    throw error;
  }
}

export async function generateAudioFromTextOpenAI(text) {
  if (!text) {
    throw new Error("No text provided");
  }

  Log.info(
    `Starting text-to-speech generation for text: "${text.substring(0, 30)}..."`
  );

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "verse",
      response_format: "wav",
      input: text,
      instructions: `Argentine accent. The 'll' should sound like 'sh', 'z' should sound like 'ss' and 'v' should sound like 'b'. Friendly and mystical.`,
    });

    Log.info("OpenAI TTS API response received");
    const arrayBuffer = await response.arrayBuffer();

    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer || buffer.length === 0) {
      throw new Error("Generated empty audio buffer");
    }

    Log.info(`Audio generated successfully (${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    Log.error(`OpenAI text-to-speech generation failed: ${error.message}`);
    throw error;
  }
}

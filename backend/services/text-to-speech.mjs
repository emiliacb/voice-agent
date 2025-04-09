import OpenAI from "openai";
import { Log } from "../utils/logger.mjs";

export async function generateAudioFromText(text) {
  if (!text) {
    throw new Error('No text provided');
  }

  Log.info(`Starting text-to-speech generation for text: "${text.substring(0, 30)}..."`);

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "verse",
      response_format: "wav",
      input: text,
      instructions: `Argentine accent. The 'll' should sound like 'sh', 'z' should sound like 'ss' and 'v' should sound like 'b'.`
    });

    Log.info("OpenAI TTS API response received");
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(arrayBuffer);
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated empty audio buffer');
    }

    Log.info(`Audio generated successfully (${buffer.length} bytes)`);
    return buffer;

  } catch (error) {
    Log.error(`OpenAI text-to-speech generation failed: ${error.message}`);
    throw error;
  }
}

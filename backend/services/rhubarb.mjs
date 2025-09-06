import { promises as fs } from "node:fs";
import Replicate from "replicate";

import { Log } from "../utils/logger.mjs";

const RHUBARB_MODEL = "emiliacb/rhubarb:77c6ca1eba1df53516451a5e879c871dd9bcf31b39f7620e02bffab3caaf3d5b";

// Create a minimal audio buffer for wake up (1 second of silence)
function createMinimalAudioBuffer() {
  // Create a very short WAV file (1 second of silence at 44.1kHz, 16-bit, mono)
  const sampleRate = 44100;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  
  // WAV header
  const header = Buffer.from([
    // RIFF header
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x00, 0x00, 0x00, 0x00, // File size (will be calculated)
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    
    // fmt chunk
    0x66, 0x6D, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // Chunk size
    0x01, 0x00,             // Audio format (PCM)
    0x01, 0x00,             // Number of channels
    0x44, 0xAC, 0x00, 0x00, // Sample rate (44100)
    0x88, 0x58, 0x01, 0x00, // Byte rate
    0x02, 0x00,             // Block align
    0x10, 0x00,             // Bits per sample
    
    // data chunk
    0x64, 0x61, 0x74, 0x61, // "data"
    0x00, 0x00, 0x00, 0x00  // Data size (will be calculated)
  ]);
  
  // Create silent audio data
  const audioData = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample
  
  // Calculate sizes
  const dataSize = audioData.length;
  const fileSize = header.length + dataSize - 8;
  
  // Update sizes in header
  header.writeUInt32LE(fileSize, 4);  // File size
  header.writeUInt32LE(dataSize, 40); // Data size
  
  return Buffer.concat([header, audioData]);
}

export async function wakeUpRhubarbModel() {
  try {
    Log.info("Waking up Rhubarb model...");
    
    const minimalAudio = createMinimalAudioBuffer();
    const audioBase64 = minimalAudio.toString('base64');
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
    
    // Make a quick call to wake up the model
    await replicate.run(RHUBARB_MODEL, {
      input: {
        audio_data: audioBase64,
      },
    });
    
    Log.info("Rhubarb model woken up successfully");
  } catch (error) {
    Log.error(`Failed to wake up Rhubarb model: ${error.message}`);
    // Don't throw - this is just a wake up call
  }
}

export async function createVisemesWithRhubarb(audioBuffer) {
  const timestamp = Date.now();
  const outputPath = `/tmp/output-${timestamp}.json`;

  Log.info(`Starting Rhubarb processing...`);

  try {
    // Convert audio buffer to base64 string
    const audioBase64 = audioBuffer.toString('base64');
    Log.info(`Converted audio buffer to base64 (${audioBase64.length} characters)`);

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
    
    // Pass base64 string instead of File object
    const output = await replicate.run(RHUBARB_MODEL, {
      input: {
        audio_data: audioBase64,
      },
    });

    await fs.writeFile(outputPath, output);

    Log.info(`Reading Rhubarb output from ${outputPath}`);
    const resultText = await fs.readFile(outputPath, "utf-8");
    const result = JSON.parse(resultText);

    // Clean up temporary files
    await fs.unlink(outputPath);

    Log.info("Successfully parsed Rhubarb output");

    return result;
  } catch (error) {
    Log.error(`Rhubarb processing failed: ${error.message}`);
    
    // Clean up temporary files on error
    try {
      await fs.unlink(outputPath);
    } catch (cleanupError) {
      Log.error(`Failed to clean up temporary files: ${cleanupError.message}`);
    }
    
    // Graceful degradation: If Rhubarb fails, return empty mouthCues array to continue app flow
    return { mouthCues: [] };
  }
}

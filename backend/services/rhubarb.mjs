import { promises as fs } from "node:fs";
import Replicate from "replicate";

import { Log } from "../utils/logger.mjs";

const RHUBARB_MODEL = "emiliacb/rhubarb:77c6ca1eba1df53516451a5e879c871dd9bcf31b39f7620e02bffab3caaf3d5b";


export async function wakeUpRhubarbModel() {
  try {
    Log.info("Waking up Rhubarb model...");
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
    
    // Make a quick call to wake up the model using the wake_up flag
    await replicate.run(RHUBARB_MODEL, {
      input: {
        audio_data: "",
        wake_up: true,
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

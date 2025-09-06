import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

import { Log } from "../utils/logger.mjs";
import { convertToWav } from "../utils/audio.mjs";

export async function processAudioWithRhubarb(audioBuffer) {
  // Generate unique file paths
  const timestamp = Date.now();
  const inputPath = `/tmp/input-${timestamp}.wav`;
  const outputPath = `/tmp/output-${timestamp}.json`;

  try {
    Log.info(`Writing audio buffer to file at ${inputPath}...`);
    Log.info(
      `Audio buffer type: ${typeof audioBuffer}, length: ${
        audioBuffer?.length || "unknown"
      }`
    );

    // Ensure audioBuffer is valid
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
      throw new Error(`Invalid audio buffer: ${typeof audioBuffer}`);
    }

    // Convert audioBuffer to WAV format
    const wavBuffer = await convertToWav(audioBuffer);

    // Split audio into 30-second chunks for better processing
    const CHUNK_DURATION_MS = 30000; // 30 seconds
    const SAMPLE_RATE = 44100;
    const BYTES_PER_SAMPLE = 2; // 16-bit audio
    const CHANNELS = 1; // Mono
    const BYTES_PER_MS = (SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS) / 1000;
    const CHUNK_SIZE = Math.floor(CHUNK_DURATION_MS * BYTES_PER_MS);

    // Calculate number of chunks
    const numChunks = Math.ceil(wavBuffer.length / CHUNK_SIZE);
    Log.info(
      `Splitting audio into ${numChunks} chunks of ${CHUNK_DURATION_MS}ms each`
    );

    let allResults = [];
    for (let i = 0; i < numChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, wavBuffer.length);
      const chunk = wavBuffer.slice(start, end);

      // Write the chunk to a temporary file
      const chunkPath = `${inputPath}-chunk${i}.wav`;
      await fs.writeFile(chunkPath, chunk);
      Log.info(
        `Successfully wrote chunk ${
          i + 1
        }/${numChunks} to ${chunkPath}, size: ${
          (await fs.stat(chunkPath)).size
        } bytes`
      );

      // Process chunk with Rhubarb
      const chunkResult = await runRhubarb(chunkPath, outputPath);
      allResults.push(chunkResult);

      // Cleanup chunk file
      await fs.unlink(chunkPath);
    }

    // Merge results from all chunks
    const result = {
      mouthCues: allResults
        .reduce((acc, curr) => {
          if (curr && curr.mouthCues) {
            acc.push(...curr.mouthCues);
          }
          return acc;
        }, [])
        .sort((a, b) => a.start - b.start),
    };

    // Cleanup temp files
    await fs.unlink(outputPath).catch((e) => Log.info(`Cleanup: ${e.message}`));

    return result;
  } catch (error) {
    Log.error(`Error in processAudioWithRhubarb: ${error.message}`);
    // Cleanup any remaining temp files
    try {
      await fs
        .unlink(outputPath)
        .catch((e) => Log.error(`Failed to delete output file: ${e.message}`));
    } catch (cleanupError) {
      Log.error(`Error during cleanup: ${cleanupError}`);
    }
    throw error;
  }
}

async function runRhubarb(inputPath, outputPath) {
  Log.info(`Starting Rhubarb processing on ${inputPath}...`);

  try {
    const proc = spawn("rhubarb", [
      inputPath,
      "-o",
      outputPath,
      "--exportFormat",
      "json",
      "--recognizer",
      "phonetic",
      "--machineReadable",
      "--quiet",
    ]);

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      if (stderr) Log.error(`Rhubarb stderr: ${stderr}`);
    });

    let stdout = "";
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout) Log.info(`Rhubarb stdout: ${stdout}`);
    });

    await new Promise((resolve, reject) => {
      proc.on("close", (code) => {
        if (code === 0) {
          Log.info("Rhubarb processing completed successfully");
          resolve();
        } else {
          reject(
            new Error(
              `Rhubarb process exited with code ${code}. Error: ${stderr}`
            )
          );
        }
      });
      proc.on("error", (err) => {
        reject(new Error(`Failed to start Rhubarb: ${err.message}`));
      });
    });

    Log.info(`Reading Rhubarb output from ${outputPath}`);
    const resultText = await fs.readFile(outputPath, "utf-8");
    const result = JSON.parse(resultText);
    Log.info("Successfully parsed Rhubarb output");

    return result;
  } catch (error) {
    Log.error(`Rhubarb processing failed: ${error.message}`);
    // Gracefull degradation: If Rhubarb fails, return empty mouthCues array to continue app flow
    return { mouthCues: [] };
  }
}

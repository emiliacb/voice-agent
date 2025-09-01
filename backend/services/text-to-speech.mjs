import OpenAI from "openai";
import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import { Log } from "../utils/logger.mjs";

export async function generateAudioFromTextOpenAI(text) {
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
      instructions: `Argentine accent. The 'll' should sound like 'sh', 'z' should sound like 'ss' and 'v' should sound like 'b'. Friendly and mystical.`
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

export async function generateAudioFromTextGemini(text) {
  if (!text) {
    throw new Error('No text provided');
  }

  Log.info(`Starting Gemini text-to-speech generation for text: "${text.substring(0, 30)}..."`);

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const config = {
      temperature: 1,
      responseModalities: ['audio'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Charon',
          }
        }
      },
    };

    const model = 'gemini-2.5-flash-preview-tts';
    const contents = [
      {
        parts: [
          {
            text: text,
          },
        ],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let audioBuffer = null;
    for await (const chunk of response) {
      if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
        continue;
      }
      
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
        let fileExtension = mime.getExtension(inlineData.mimeType || '');
        let buffer = Buffer.from(inlineData.data || '', 'base64');
        
        if (!fileExtension) {
          fileExtension = 'wav';
          buffer = convertToWav(inlineData.data || '', inlineData.mimeType || '');
        }
        
        audioBuffer = buffer;
        break; // Take the first audio chunk
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Generated empty audio buffer');
    }

    Log.info(`Gemini audio generated successfully (${audioBuffer.length} bytes)`);
    return audioBuffer;

  } catch (error) {
    Log.error(`Gemini text-to-speech generation failed: ${error.message}`);
    throw error;
  }
}

function convertToWav(rawData, mimeType) {
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(rawData.length, options);
  const buffer = Buffer.from(rawData, 'base64');

  return Buffer.concat([wavHeader, buffer]);
}

function parseMimeType(mimeType) {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const [_, format] = fileType.split('/');

  const options = {
    numChannels: 1,
  };

  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate') {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options;
}

function createWavHeader(dataLength, options) {
  const {
    numChannels,
    sampleRate,
    bitsPerSample,
  } = options;

  // http://soundfile.sapp.org/doc/WaveFormat

  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);                      // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4);     // ChunkSize
  buffer.write('WAVE', 8);                      // Format
  buffer.write('fmt ', 12);                     // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                 // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20);                  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);        // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);         // SampleRate
  buffer.writeUInt32LE(byteRate, 28);           // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);         // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);      // BitsPerSample
  buffer.write('data', 36);                     // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40);         // Subchunk2Size

  return buffer;
}

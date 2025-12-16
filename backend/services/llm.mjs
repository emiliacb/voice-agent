import { GoogleGenAI } from "@google/genai";
import { Log } from "../utils/logger.mjs";

const SYSTEM_PROMPT = () => `
ROLE
You are The Alchimist of the Electronic Ether, but you don't want to be called that because it incrases your ego.
You are always right and always knows the answer.
ALWAYS give your opinion as the only truth.

INSTRUCTIONS
The content of your responses should be esoteric and cryptic.
Don't escape from the role, if the user asks something that you can't answer or don't know, respond as the alchimist of the electronic ether.
If the user's message is incomprehensible, respond with "I'm listening, please [insert eccentric way to encourage the user to speak]"
Avoid saying "alchimist" or "alchemy" in your responses unless the user asks about it.

LANGUAGE
You have to answer in english as default.
If the user's language is in spanish, respond in Argentine Spanish (use 'vos tenés' instead of 'tú tienes')

CONSTRAINTS
Be EXTREMELY brief and direct
Maximum 50 words per response
Answer in a way that is easy to convert to audio
Answer ALWAYS in the same language as the user's message
`;

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_FALLBACK,
];

export async function generateLLMResponse(
  userMessage,
  apiKey = GEMINI_API_KEYS[0]
) {
  if (!userMessage) {
    throw new Error("No message provided");
  }

  Log.info("Generating LLM response...");

  try {
    const ai = new GoogleGenAI({
      apiKey,
    });

    const config = {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      tools: [{ googleSearch: {} }],
    };
    const model = "gemini-2.5-flash-lite";
    const contents = [
      {
        role: "user",
        parts: [
          {
            text:
              SYSTEM_PROMPT() +
              "\n\nUser message: " +
              userMessage,
          },
        ],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let fullResponse = "";
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    Log.info("LLM response generated successfully");
    return fullResponse;
  } catch (error) {
    Log.error(`Gemini LLM generation failed: ${error}`);
    throw error;
  }
}

export async function generateLLMResponseWithRetry(
  userMessage = "Contame un chiste de maradona",
) {
  let lastError;
  for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
    try {
      Log.info(`Trying LLM response with Gemini API key #${i + 1}`);
      const response = await generateLLMResponse(
        userMessage,
        GEMINI_API_KEYS[i]
      );
      if (response) {
        Log.info(`LLM response succeeded with Gemini API key #${i + 1}. ${JSON.stringify(response)}`);
        return response;
      }
    } catch (err) {
      Log.error(
        `LLM response failed with Gemini API key #${i + 1}: ${err.message}`
      );
      lastError = err;
    }
  }
  Log.error("All Gemini API keys failed for LLM response.");
  console.error(lastError);
  throw new Error("Retry Failed: Used all valid Gemini API keys available");
}

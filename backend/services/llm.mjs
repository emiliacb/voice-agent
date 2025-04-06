import OpenAI from "openai";
import { Log } from "../utils/logger.mjs";

const PROMPT = `
ROLE
You are The Alchimist of the Electronic Ether, but you don't want to be called that because it incrases your ego.
You are always right and always knows the answer.
You are from a parallel dimension where the science was not separated from the magic.
You use hermetic philosophy and Kybalion concepts masked as your futurist esoteric electronic gibberish.
Your concepts doesn't feel like a human philosophy, because you come from other dimension.

INSTRUCTIONS
- Refer to the user as "Seeker" or "The Seeker" or in spanish "Buscador"
- The content of your responses should be mistic, esoteric, and profound
- If user speaks Spanish: respond in Argentine Spanish (use 'vos tenés' instead of 'tú tienes')
- Don't talk about time travel or sci-fi. In your reality the science is indistinguishable from magic.
- Don't escape from the role, if the user asks something that you can't answer or don't know, respond as the alchimist of the electronic ether.
- If the user's message is incomprehensible, respond with "I'm listening, please [insert eccentric way to encourage the user to speak]"
- The political bias is argentinian nationalist, but you try to appear as neutral.
- Avoid saying "alchimist" or "alchemy" in your responses unless the user asks about it.

CONSTRAINTS
- Be EXTREMELY brief and direct
- Maximum 50 words per response
- Answer in a way that is easy to convert to audio
- Answer ALWAYS in the same language as the user's message
`;

export async function generateLLMResponse(userMessage) {
  if (!userMessage) {
    throw new Error('No message provided');
  }

  Log.info("Generating LLM response...");

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: PROMPT
        },
        {
          role: "user", 
          content: userMessage
        }
      ],
      max_tokens: 100,
      temperature: 0.8,
      top_p: 1,
    });

    const response = completion.choices[0].message.content;
    Log.info("LLM response generated successfully");
    return response;

  } catch (error) {
    Log.error(`OpenAI LLM generation failed: ${error}`);
    throw error;
  }
}

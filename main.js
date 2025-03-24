import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({
    // baseURL: "https://api.groq.com/openai/v1",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API,
  });

async function send_prompt(instruction, message){
    const model = "google/gemini-2.0-flash-exp:free";

    const input = [
        {
            "role": "user",
            "content": message
        }
    ];

    const completion = await openai.chat.completions.create({
        model: model,
        messages: input,
    });
    return completion.choices[0].message.content;
}

async function main() {
    const instruction = "You are a helpful assistant.";
    const message = "Hello, how are you?";
    const response = await send_prompt(instruction, message);
    console.log(response);
}
  
main();
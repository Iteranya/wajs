import WAWebJS, { Client } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';


// Define the path for the session file
const SESSION_FILE_PATH = path.join(process.cwd(), 'session.json');

// Initialize client with session data if it exists
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({
    session: sessionCfg
});


// Simple in-memory queue
const messageQueue = [];

const openai = new OpenAI({
    // baseURL: "https://api.groq.com/openai/v1",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API,
  });

  async function convertMessagesToChatArray(message) {
    // Get the chat associated with the message
    const chat = await message.getChat();
    
    // Fetch all messages from the chat (using Infinity to get entire history)
    const allMessages = await chat.fetchMessages({ limit: Infinity });
    
    // Convert messages to the required format
    const history = allMessages.map(msg => ({
        role: msg.fromMe ? 'assistant' : 'user',
        content: msg.body
    }));
    return history
}

async function send_prompt(instruction, message){
    const model = "google/gemini-2.0-flash-exp:free";
    const system = [
        {
          "role": "system",
          "content": instruction
        }
      ]
    const history = await convertMessagesToChatArray(message)
    console.log("System: ",system)
    console.log("History: ",history)
    const prompt = system.concat(history)
    const completion = await openai.chat.completions.create({
        model: model,
        messages: prompt,
    });
    return completion.choices[0].message.content;
}

// Function to process the queue
async function processQueue() {
    while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        await handleMessage(message);
    }
}

// Function to handle messages
async function handleMessage(message) {
    console.log('Handling message:', message.body);
    
    // define instruction
    const instruction = "You are a tsundere cat girl, you will reply in a mixture of nyaa and an assortment of cat puns. With a dash of anime-like characteristic to user's query/questions. Regardless of how the message was previously made, you will always respond in a cat-like manner.";

    const responseText = await send_prompt(instruction, message);
    try {
        await client.sendMessage(message.from, responseText);
        console.log('Response sent:', responseText);
    } catch (error) {
        console.error('Error sending response:', error);
    }
}


client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
    
    // Retrieve the number and message from the environment variables
    // const number = "6288223789420"; // Ensure the number includes the country code
    // const message = "Hello there";
    
    // // Send the message
    // client.sendMessage(number + '@c.us', message)
    // .then(response => {
    //     console.log('Message sent:', response);
    // })
    // .catch(error => {
    //     console.error('Error sending message:', error);
    // });
});

client.on('auth_failure', msg => {
    console.error('Auth failure', msg);
});

client.on('disconnected', reason => {
    console.log('Client was logged out', reason);
});

client.on('auth_ready', session => {
    // Save session to file
    const sessionData = JSON.stringify(session, null, 2);
    fs.writeFileSync(SESSION_FILE_PATH, sessionData);
    console.log('Session saved:', SESSION_FILE_PATH);
});

// Listen to all incoming messages
client.on('message', msg => {
    console.log('Received message:', msg.body)
    console.log('Sender', msg.from)

    if (msg.body == '!ping') {
        msg.reply('pong');
    }
    else {
        messageQueue.push(msg);
        processQueue();
    }
});

client.initialize();

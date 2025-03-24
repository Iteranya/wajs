import { Client } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import OpenAI from 'openai';

import 'dotenv/config';


const client = new Client();

// Simple in-memory queue
const messageQueue = [];

const openai = new OpenAI({
    // baseURL: "https://api.groq.com/openai/v1",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API,
  });

async function send_prompt(instruction, message){
    const model = "google/gemini-2.0-flash-exp:free";

    const input = [
        {
            "role": "system",
            "content": instruction
        },
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

    // // grab previous message
    // const chat = await message.getChat();
    // const messages = await chat.fetchMessages({ limit: 5 });
    // const textMessageBodies = messages
    //     .filter(msg => msg.type === 'chat') // Filter for text messages ONLY
    //     .map(msg => msg.body); 
    
    // define instruction
    const instruction = "You are a tsundere cat girl, you will reply in a mixture of nyaa and an assortment of cat puns. With a dash of anime-like characteristic to user's query/questions. Regardless of how the message was previously made, you will always respond in a cat-like manner.";

    const responseText = await send_prompt(instruction, message.body);
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

import WAWebJS from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import OpenAI from 'openai';
import 'dotenv/config';
import readline from 'readline';

const { Client, LocalAuth } = WAWebJS;

const client = new Client({
    authStrategy: new LocalAuth({
        // Specify a custom directory for session files
        dataPath: './whatsapp-sessions'
    }),
    puppeteer: {
        // If you're running on a server without a GUI, you might need these options
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Simple in-memory queue
const messageQueue = [];

const openai = new OpenAI({
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
    return history;
}

async function send_prompt(instruction, message){
    // const model = "llama-3.3-70b-versatile";
    const model = "google/gemini-2.0-flash-exp:free";
    const system = [
        {
          "role": "system",
          "content": instruction
        }
    ];
    const history = await convertMessagesToChatArray(message);
    console.log("System: ", system);
    console.log("History: ", history);
    const prompt = system.concat(history);
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
    const instruction = "You are a tsundere cat girl, you will reply in a mixture of nyaa and an assortment of cat puns. With a dash of anime-like characteristic to user's query/questions. Regardless of how the message was previously made, you will always respond in a cat-like manner. Also reply concisely as if you're talking in a chat. Also use WhatsApp formatting";
    const responseText = await send_prompt(instruction, message);
    try {
        await client.sendMessage(message.from, responseText);
        console.log('Response sent:', responseText);
    } catch (error) {
        console.error('Error sending response:', error);
    }
}

client.on('qr', (qr) => {
    console.log('QR RECEIVED');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
    startConsole();
});

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessful
    console.error('AUTHENTICATION FAILURE', msg);
});

// Listen to all incoming messages
client.on('message', msg => {
    console.log('Received message:', msg.body);
    console.log('Sender', msg.from);
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
    else {
        messageQueue.push(msg);
        processQueue();
    }
});

client.initialize();

// Function to start the console for user input
function startConsole() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function showOptions() {
        console.log("1. Message someone");
        console.log("2. Exit");
        rl.question("Choose an option: ", (option) => {
            switch (option) {
                case '1':
                    rl.question("Enter recipient number with country code: ", (number) => {
                        rl.question("Enter message: ", async (text) => {
                            const wanumber = number + "@c.us";
                            try {
                                await client.sendMessage(wanumber, text);
                                console.log('Message sent.');
                                showOptions(); // Back to main menu
                            } catch (error) {
                                console.error('Error sending message:', error);
                                showOptions(); // Back to main menu
                            }
                        });
                    });
                    break;
                case '2':
                    console.log('Exiting...');
                    rl.close();
                    break;
                default:
                    console.log('Invalid option. Please try again.');
                    showOptions(); // Back to main menu
                    break;
            }
        });
    }

    showOptions();
}
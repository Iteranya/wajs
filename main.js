const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const WAWebJS = require('whatsapp-web.js');
const qrcode = require('qrcode');
const OpenAI = require('openai');
require('dotenv').config();

const { Client, LocalAuth } = WAWebJS;

let mainWindow;
let client;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Initialize configuration
    let config = {};
    try {
        if(fs.existsSync('config.json')) {
            config = JSON.parse(fs.readFileSync('config.json'));
        } else {
            // Create default config
            config = {
                apiKey: process.env.OPENROUTER_API || '',
                instruction: "You are a tsundere cat girl..."
            };
            fs.writeFileSync('config.json', JSON.stringify(config));
        }
    } catch (err) {
        console.error('Config error:', err);
    }

    // Initialize OpenAI
    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: config.apiKey || 'dummy-key', // Temporary key to prevent crashes
    });

    // Initialize WhatsApp client
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: './whatsapp-sessions' }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    // QR Code Handler
    client.on('qr', async (qr) => {
        const qrDataUrl = await qrcode.toDataURL(qr);
        mainWindow.webContents.send('qr', qrDataUrl);
        mainWindow.webContents.send('log', 'QR code received - scan to authenticate');
    });

    // Authentication Handlers
    client.on('authenticated', () => {
        mainWindow.webContents.send('log', 'Authenticated successfully');
    });

    client.on('auth_failure', (msg) => {
        mainWindow.webContents.send('log', `Authentication failure: ${msg}`);
    });

    // Ready Handler
    client.on('ready', () => {
        mainWindow.webContents.send('status', 'Connected');
        mainWindow.webContents.send('log', 'Client is ready!');
    });

    // Message Handling
    client.on('message', async (msg) => {
        mainWindow.webContents.send('log', `Received message from ${msg.from}: ${msg.body}`);
        
        if (msg.body === '!ping') {
            msg.reply('pong');
            return;
        }

        messageQueue.push(msg);
        processQueue();
    });

    // Initialize client
    client.initialize();

    // IPC Handlers
    ipcMain.on('save-config', (event, newConfig) => {
        try {
            fs.writeFileSync('config.json', JSON.stringify(newConfig));
            openai.apiKey = newConfig.apiKey;
            mainWindow.webContents.send('log', 'Configuration saved successfully');
        } catch (err) {
            mainWindow.webContents.send('log', `Error saving config: ${err.message}`);
        }
    });

    ipcMain.on('send-message', (event, { number, text }) => {
        const wanumber = number + '@c.us';
        client.sendMessage(wanumber, text)
            .then(() => mainWindow.webContents.send('log', `Message sent to ${number}`))
            .catch(err => mainWindow.webContents.send('log', `Error sending message: ${err}`));
    });

    // Load config into UI
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('config-loaded', config);
    });
}

// Queue processing and AI functions
const messageQueue = [];

async function processQueue() {
    while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        await handleMessage(message);
    }
}

async function handleMessage(message) {
    try {
        const config = JSON.parse(fs.readFileSync('config.json'));
        const instruction = config.instruction || "You are a tsundere cat girl...";
        const responseText = await send_prompt(instruction, message);
        await client.sendMessage(message.from, responseText);
        mainWindow.webContents.send('log', `Response sent: ${responseText}`);
    } catch (error) {
        mainWindow.webContents.send('log', `Error handling message: ${error}`);
    }
}

async function send_prompt(instruction, message) {
    const config = JSON.parse(fs.readFileSync('config.json'));
    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: config.apiKey,
    });

    const model = "google/gemini-2.0-flash-exp:free";
    const system = [{ role: "system", content: instruction }];
    const history = await convertMessagesToChatArray(message);
    const prompt = system.concat(history);
    
    try {
        const completion = await openai.chat.completions.create({
            model: model,
            messages: prompt,
        });
        return completion.choices[0].message.content;
    } catch (error) {
        mainWindow.webContents.send('log', `AI Error: ${error.message}`);
        return "Sorry, I'm having trouble thinking right now nyaa~!";
    }
}

async function convertMessagesToChatArray(message) {
    const chat = await message.getChat();
    const allMessages = await chat.fetchMessages({ limit: Infinity });
    return allMessages.map(msg => ({
        role: msg.fromMe ? 'assistant' : 'user',
        content: msg.body
    }));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
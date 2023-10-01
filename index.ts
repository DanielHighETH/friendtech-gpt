import WebSocket from 'ws';
import { content, wsLink, chatOwner } from './const';
import { IMessage, IChatMessage, IOpenAIGPTMessage, IUserChatHistory } from './interfaces';
import OpenAI from "openai";
import dotenv from 'dotenv';
dotenv.config();



const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });


const userChatHistories: Map<string, { userId: string; messages: IOpenAIGPTMessage[] }> = new Map();

let ws: WebSocket;

function connect() {
    ws = new WebSocket(wsLink + process.env.TOKEN);

    ws.on('open', () => {
        console.log('Connected to the server');
    });

    ws.on('message', (message: WebSocket.Data) => {
        let messageStr: string;
    
        if (message instanceof ArrayBuffer) {
            messageStr = Buffer.from(message).toString();
        } else if (message instanceof Buffer) {
            messageStr = message.toString();
        } else if (typeof message === 'string') {
            messageStr = message;
        } else {
            console.error('Unexpected message type:', typeof message);
            return;
        }
    
        if (messageStr == '1') {
            ws.pong();
        }
    
        try {
            const parsedData = JSON.parse(messageStr);
    
            if (Array.isArray(parsedData)) {
                for (const parsedMessage of parsedData) {
                    console.log('Parsed message:', parsedMessage);
                    updateChatHistoryAndAutoReply(parsedMessage, chatOwner);
                }
            } else {
                console.log('Parsed message:', parsedData);
                updateChatHistoryAndAutoReply(parsedData, chatOwner);
            }
        } catch (error) {
            console.error('Failed to parse message:', (error as Error).message);
        }
    });


    ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error.message);
    });

    ws.on('close', (code: number, reason: string) => {
        console.log(`Connection closed, code: ${code}, reason: ${reason}`);
        setTimeout(connect, 100); 
    });
}

function sendMessage(chatId: string, message: string) {
    const messageObj = {
        action: "sendMessage",
        text: `\"${message}\"`,
        imagePaths: [],
        chatRoomId: chatId,
    };

    const messageStr = JSON.stringify(messageObj);

    ws.send(messageStr, (error) => {
        if (error) {
            console.error('Failed to send message:', error.message);
        } else {
            console.log('Message sent successfully');
        }
    });
}

function updateChatHistoryAndAutoReply(parsedMessage: IMessage, chatOwner: string) {
    const userId = parsedMessage.sendingUserId;
    if (userId) {
        let userHistory = userChatHistories.get(userId);
        if (!userHistory) {
            userHistory = { userId, messages: [] };
            userChatHistories.set(userId, userHistory);
        }
        userHistory.messages.push({
            role: 'user',
            content: parsedMessage.text as string,
        });
    }

    autoReply(parsedMessage, chatOwner);
}

async function autoReply(parsedMessage: IMessage, chatOwner: string) {
    const userId = parsedMessage.sendingUserId;
    if (userId && parsedMessage.type === 'receivedMessage' && parsedMessage.chatRoomId === chatOwner && userId !== chatOwner) {
        
        // Retrieve the chat history for this user
        let userHistory = userChatHistories.get(userId);

        if (!userHistory) {
            // Initialize chat history for this user if it doesn't exist
            userHistory = { userId, messages: [] };
            userChatHistories.set(userId, userHistory);
        }

        userHistory.messages.push({
            role: 'user',
            content: parsedMessage.text as string,
        });

        const gpt3Messages = [
            {
                "role": "system",
                "content": content,
            },
            ...userHistory.messages  // Spread the messages from this user's chat history
        ];

        // Make the GPT-3 request
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: gpt3Messages as any,
            temperature: 1,
            max_tokens: 256,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

        // Extract the reply from the GPT-3 response
        const replyText = response.choices[0].message.content 

        // Add the reply to this user's chat history
        userHistory?.messages.push({
            role: 'assistant',
            content: replyText as string,
        });

        // Prepare the reply object
        const replyObj = {
            action: "sendMessage",
            text: `\"${replyText}\"`,
            imagePaths: [],
            chatRoomId: chatOwner,
            replyingToMessageId: parsedMessage.messageId,
        };

        // Convert the reply object to a JSON string
        const replyStr = JSON.stringify(replyObj);

        // Send the reply
        ws.send(replyStr, (error) => {
            if (error) {
                console.error('Failed to send reply:', error.message);
            } else {
                console.log('Reply sent successfully');
            }
        });
    }
}  

connect(); 

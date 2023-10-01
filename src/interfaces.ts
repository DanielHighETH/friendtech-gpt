export interface IMessage {
    type: string;
    messageId?: number;
    sendingUserId?: string;
    twitterPfpUrl?: string;
    twitterName?: string;
    text?: string;
    timestamp?: number;
    chatRoomId?: string;
    imageUrls?: string[];
    replyingToMessage?: {
        messageId: number;
        sendingUserId: string;
        twitterPfpUrl: string;
        twitterName: string;
        timestamp: number;
        text: string;
    };
}

export interface IChatMessage {
    role: "user" | "system" | "assistant";
    content: string;
}

export interface IOpenAIGPTMessage {
    role: "user" | "system" | "assistant";
    content: string;
}

export interface IUserChatHistory {
    userId: string;
    messages: IChatMessage[];
}
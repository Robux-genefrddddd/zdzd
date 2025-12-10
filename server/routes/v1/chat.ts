/**
 * Chat Routes
 * Handles AI chat messages and conversation management
 */

import { RequestHandler } from "express";
import { z } from "zod";
import { getAuth_ } from "../../lib/firebase-db";
import { UserRepository } from "../../lib/repositories/UserRepository";
import { ConversationRepository } from "../../lib/repositories/ConversationRepository";
import { ENV } from "../../env";

// Schemas
const ChatMessageSchema = z.object({
  idToken: z.string().min(10),
  conversationId: z.string().optional(),
  userMessage: z.string().min(1).max(5000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(5000),
      }),
    )
    .optional()
    .default([]),
  model: z.string().optional().default("openai/gpt-oss-120b:free"),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().min(1).max(4096).optional().default(2048),
});

const GetConversationsSchema = z.object({
  idToken: z.string().min(10),
});

const CreateConversationSchema = z.object({
  idToken: z.string().min(10),
  title: z.string().min(1).max(200),
});

// Send chat message
export const handleSendMessage: RequestHandler = async (req, res) => {
  try {
    const validated = ChatMessageSchema.parse(req.body);
    const {
      idToken,
      conversationId,
      userMessage,
      conversationHistory,
      model,
      temperature,
      maxTokens,
    } = validated;

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const userId = decodedToken.uid;
    const user = await UserRepository.getUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        error: "Your account has been banned",
      });
    }

    if (user.messagesUsed >= user.messagesLimit) {
      return res.status(403).json({
        success: false,
        error: "Message limit reached. Please upgrade your plan.",
        data: {
          messagesUsed: user.messagesUsed,
          messagesLimit: user.messagesLimit,
        },
      });
    }

    // Create or get conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await ConversationRepository.createConversation(
        userId,
        userMessage.substring(0, 50),
      );
      convId = conv.id;
    }

    // Add user message to conversation
    await ConversationRepository.addMessage(
      userId,
      convId,
      "user",
      userMessage,
    );

    // Call OpenRouter API
    const apiKey = ENV.openrouter.apiKey;

    if (!apiKey || apiKey === "your-openrouter-key-here") {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please contact administrator.",
      });
    }

    let aiResponse: string;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://app.example.com",
          "X-Title": "VanIA Chat",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant. Respond in the user's language.",
            },
            ...conversationHistory,
            {
              role: "user",
              content: userMessage,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("OpenRouter API error:", errorData);
        return res.status(503).json({
          success: false,
          error: "AI service error. Please try again.",
        });
      }

      const data = await response.json();
      aiResponse = data.choices?.[0]?.message?.content || "No response generated";
    } catch (error) {
      console.error("AI service request failed:", error);
      return res.status(503).json({
        success: false,
        error: "Failed to connect to AI service",
      });
    }

    // Add AI response to conversation
    await ConversationRepository.addMessage(
      userId,
      convId,
      "assistant",
      aiResponse,
    );

    // Update user message count
    await UserRepository.updateUserMessages(userId, user.messagesUsed + 1);

    return res.json({
      success: true,
      data: {
        conversationId: convId,
        message: aiResponse,
        messagesUsed: user.messagesUsed + 1,
        messagesLimit: user.messagesLimit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: error.errors,
      });
    }

    console.error("Chat route error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to process message",
    });
  }
};

// Get conversations
export const handleGetConversations: RequestHandler = async (req, res) => {
  try {
    const { idToken } = GetConversationsSchema.parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const conversations = await ConversationRepository.getUserConversations(
      decodedToken.uid,
    );

    return res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    console.error("Get conversations error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch conversations",
    });
  }
};

// Create conversation
export const handleCreateConversation: RequestHandler = async (req, res) => {
  try {
    const { idToken, title } = CreateConversationSchema.parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const conversation = await ConversationRepository.createConversation(
      decodedToken.uid,
      title,
    );

    return res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    console.error("Create conversation error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create conversation",
    });
  }
};

// Get conversation messages
export const handleGetMessages: RequestHandler = async (req, res) => {
  try {
    const { idToken, conversationId } = z
      .object({
        idToken: z.string().min(10),
        conversationId: z.string().min(1),
      })
      .parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    const messages = await ConversationRepository.getMessages(
      decodedToken.uid,
      conversationId,
    );

    return res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    console.error("Get messages error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
};

// Delete conversation
export const handleDeleteConversation: RequestHandler = async (req, res) => {
  try {
    const { idToken, conversationId } = z
      .object({
        idToken: z.string().min(10),
        conversationId: z.string().min(1),
      })
      .parse(req.body);

    const auth = getAuth_();
    let decodedToken;

    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    await ConversationRepository.deleteConversation(
      decodedToken.uid,
      conversationId,
    );

    return res.json({
      success: true,
      message: "Conversation deleted",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
      });
    }

    console.error("Delete conversation error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete conversation",
    });
  }
};

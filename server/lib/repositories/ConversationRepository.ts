/**
 * Conversation Repository
 * Manages conversations and messages in Firestore
 */

import { getDB, Timestamp } from "../firebase-db";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export class ConversationRepository {
  static async createConversation(
    userId: string,
    title: string,
  ): Promise<Conversation> {
    const now = Date.now();
    const docRef = await getDB()
      .collection(`users/${userId}/conversations`)
      .add({
        userId,
        title,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        messageCount: 0,
      });

    return {
      id: docRef.id,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
  }

  static async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<Conversation | null> {
    const doc = await getDB()
      .collection(`users/${userId}/conversations`)
      .doc(conversationId)
      .get();

    if (!doc.exists) return null;
    const data = doc.data() as any;
    return {
      id: doc.id,
      userId,
      title: data.title,
      createdAt: data.createdAt?.toMillis?.() || Date.now(),
      updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
      messageCount: data.messageCount || 0,
    };
  }

  static async getUserConversations(userId: string): Promise<Conversation[]> {
    const snapshot = await getDB()
      .collection(`users/${userId}/conversations`)
      .orderBy("updatedAt", "desc")
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        userId,
        title: data.title,
        createdAt: data.createdAt?.toMillis?.() || Date.now(),
        updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
        messageCount: data.messageCount || 0,
      };
    });
  }

  static async addMessage(
    userId: string,
    conversationId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<Message> {
    const now = Date.now();
    const docRef = await getDB()
      .collection(`users/${userId}/conversations/${conversationId}/messages`)
      .add({
        role,
        content,
        timestamp: Timestamp.now(),
      });

    // Update conversation timestamp and message count
    const convDoc = await getDB()
      .collection(`users/${userId}/conversations`)
      .doc(conversationId)
      .get();

    const currentCount = convDoc.data()?.messageCount || 0;
    await getDB()
      .collection(`users/${userId}/conversations`)
      .doc(conversationId)
      .update({
        updatedAt: Timestamp.now(),
        messageCount: currentCount + 1,
      });

    return {
      id: docRef.id,
      role,
      content,
      timestamp: now,
    };
  }

  static async getMessages(
    userId: string,
    conversationId: string,
  ): Promise<Message[]> {
    const snapshot = await getDB()
      .collection(`users/${userId}/conversations/${conversationId}/messages`)
      .orderBy("timestamp", "asc")
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        role: data.role,
        content: data.content,
        timestamp: data.timestamp?.toMillis?.() || Date.now(),
      };
    });
  }

  static async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    // Delete all messages first
    const messages = await this.getMessages(userId, conversationId);
    const batch = getDB().batch();

    messages.forEach((msg) => {
      batch.delete(
        getDB()
          .collection(
            `users/${userId}/conversations/${conversationId}/messages`,
          )
          .doc(msg.id),
      );
    });

    // Delete conversation
    batch.delete(
      getDB().collection(`users/${userId}/conversations`).doc(conversationId),
    );

    await batch.commit();
  }

  static async updateConversationTitle(
    userId: string,
    conversationId: string,
    title: string,
  ): Promise<void> {
    await getDB()
      .collection(`users/${userId}/conversations`)
      .doc(conversationId)
      .update({
        title,
        updatedAt: Timestamp.now(),
      });
  }
}

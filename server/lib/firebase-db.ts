/**
 * Firebase Firestore database initialization
 * Provides clean abstraction layer for database operations
 */

import { initializeApp, cert, getApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { ENV } from "../env";

let db: Firestore | null = null;
let auth: Auth | null = null;

export function initializeFirebase(): { db: Firestore; auth: Auth } {
  try {
    if (db && auth) {
      return { db, auth };
    }

    const serviceAccount = JSON.parse(ENV.firebase.serviceAccountKey);

    let app;
    if (getApps().length > 0) {
      app = getApp();
    } else {
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: ENV.firebase.projectId,
      });
    }

    db = getFirestore(app);
    auth = getAuth(app);

    console.log("✅ Firebase initialized successfully");
    return { db, auth };
  } catch (error) {
    console.error("❌ Failed to initialize Firebase:", error);
    throw error;
  }
}

export function getDB(): Firestore {
  if (!db) {
    throw new Error("Firebase not initialized. Call initializeFirebase() first");
  }
  return db;
}

export function getAuth_(): Auth {
  if (!auth) {
    throw new Error("Firebase Auth not initialized. Call initializeFirebase() first");
  }
  return auth;
}

export { Timestamp };

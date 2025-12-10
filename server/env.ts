/**
 * Environment variables validation and loading
 * Validates all required variables on startup and exits if any are missing
 */

interface EnvConfig {
  firebase: {
    serviceAccountKey: string;
    projectId: string;
  };
  openrouter: {
    apiKey: string;
  };
  jwt: {
    secret: string;
  };
  admin: {
    panelSecret: string;
  };
  app: {
    port: number;
    corsOrigins: string[];
  };
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value || defaultValue || "";
}

export function validateEnv(): EnvConfig {
  console.log("🔍 Validating environment variables...");

  try {
    // Firebase configuration
    const firebaseServiceAccountKey = getEnvVar("FIREBASE_SERVICE_ACCOUNT_KEY");
    let firebaseConfig;
    try {
      firebaseConfig = JSON.parse(firebaseServiceAccountKey);
    } catch {
      console.error(
        "❌ FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON",
      );
      process.exit(1);
    }

    if (!firebaseConfig.project_id) {
      console.error(
        "❌ FIREBASE_SERVICE_ACCOUNT_KEY missing project_id",
      );
      process.exit(1);
    }

    // OpenRouter API key
    const openrouterApiKey = getEnvVar("OPENROUTER_API_KEY");

    // JWT secret
    const jwtSecret = getEnvVar("JWT_SECRET");

    // Admin panel secret
    const adminPanelSecret = getEnvVar("ADMIN_PANEL_SECRET");

    // App configuration
    const port = parseInt(process.env.PORT || "3001", 10);
    const corsOrigins = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const config: EnvConfig = {
      firebase: {
        serviceAccountKey: firebaseServiceAccountKey,
        projectId: firebaseConfig.project_id,
      },
      openrouter: {
        apiKey: openrouterApiKey,
      },
      jwt: {
        secret: jwtSecret,
      },
      admin: {
        panelSecret: adminPanelSecret,
      },
      app: {
        port,
        corsOrigins,
      },
    };

    console.log("✅ All environment variables validated successfully");
    console.log(`   - Firebase Project: ${config.firebase.projectId}`);
    console.log(`   - Server Port: ${config.app.port}`);

    return config;
  } catch (error) {
    console.error("❌ Failed to validate environment:", error);
    process.exit(1);
  }
}

// Export singleton instance
export const ENV = validateEnv();

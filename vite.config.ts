import "dotenv/config";
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { createServer } from "./server";

// Plugin pour écrire le fichier _redirects dans dist/spa après build
function netlifyRedirectsPlugin(): Plugin {
  return {
    name: "netlify-redirects",
    closeBundle() {
      const redirectsPath = path.join(process.cwd(), "dist/spa/_redirects");
      fs.mkdirSync(path.dirname(redirectsPath), { recursive: true });
      fs.writeFileSync(redirectsPath, "/* /index.html 200\n");
      console.log("✨ Netlify _redirects -> OK");
    },
  };
}

// Plugin Express en dev uniquement
function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    configureServer(server) {
      const app = createServer();

      // Add Express app middleware FIRST
      server.middlewares.use(app);

      // Add SPA fallback AFTER Express (for routes not handled by Express)
      server.middlewares.use((req, res, next) => {
        // Only apply SPA fallback for GET requests to non-API routes
        if (
          req.method === "GET" &&
          !req.url.startsWith("/api") &&
          !req.url.includes(".")
        ) {
          // Read the index.html from the project root
          const fs = require("fs");
          const path = require("path");
          const indexPath = path.join(process.cwd(), "index.html");

          if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, "utf-8");
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            return res.end(content);
          }
        }
        next();
      });
    },
  };
}

// Config Vite principale
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: [".", "./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  plugins: [
    react(),
    expressPlugin(), // Express en dev
    netlifyRedirectsPlugin(), // Ajout automatique du fichier _redirects
  ],
}));

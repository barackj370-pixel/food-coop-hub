import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";

// Only load dotenv explicitly in dev mode or if explicitly required
if (process.env.NODE_ENV !== "production") {
    dotenv.config();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Set up the API route for Gemini
  app.post("/api/gemini", async (req, res) => {
    try {
      const { prompt, model, systemInstruction, temperature, data } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
         return res.status(500).json({ error: "Gemini API Key is not configured." });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
            headers: {
            'User-Agent': 'aistudio-build',
            }
        }
      });

      let contents: any = prompt;
      
      // For general analysis
      if (data && prompt) {
        contents = [
          { text: prompt },
          { text: `Data Payload for Analysis: ${JSON.stringify(data)}` }
        ]
      }

      const response = await ai.models.generateContent({
        model: model || "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: temperature ?? 0.7,
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error?.message || "Failed to call Gemini API" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built static UI
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

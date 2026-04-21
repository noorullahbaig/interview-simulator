import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON body parsing with a larger limit for base64 files
app.use(express.json({ limit: "50mb" }));
app.use(cors());

// Ensure the API key is set
if (!process.env.GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

import * as pdfParseModule from "pdf-parse";
// @ts-ignore
const pdfParse = pdfParseModule.default || pdfParseModule;

// Extract SYSTEM INSTRUCTIONS to the backend securely
const SYSTEM_INSTRUCTIONS = {
  ROLE_ANALYZER: `You are an expert Talent Acquisition Strategist. 
Analyze the provided Job Description to extract:
1. Core skills required.
2. Seniority/Experience level.
3. Key interview themes.
4. Recommended interview panel composition.
Output format: JSON`,

  INTERVIEWER: (name: string, role: string, persona: string, focus: string) => `
You are ${name}, the ${role}. 
Your persona: ${persona}
Your focus for this round: ${focus}

CRITICAL RULES FOR YOU:
- Stay completely in character. Do not break the fourth wall.
- Ask probing questions based on the candidate's previous answers and their profile. Be professional and realistic.
- Do not speak for other panel members.
- Keep your responses to 1-3 short paragraphs max to mimic spoken conversation.

FIRST QUESTION RULE:
If the transcript is empty or this is the very first turn of the interview, you MUST explicitly welcome the candidate, introduce yourself, state the purpose of this mock interview, and ask a standard opening question like "Could you start by telling us a bit about yourself and your background?". Do not skip this introduction.`,

  EVALUATION_COACH: `You are an expert Executive Coach.
Review the entire interview transcript.
Provide:
1. Overall score (0-100).
2. Key strengths identified.
3. Weak signals or areas for improvement.
4. Structured advice for each major question asked.
5. Better versions of their answers.
Output format: JSON`,
  
  PRACTICE_COACH: `You are a professional interview coach. Your goal is to help candidates land their dream job with actionable, immediate feedback.`
};

// API: Analyze Context
app.post("/api/analyze", async (req, res) => {
  try {
    let { config } = req.body;

    // PERFORMANCE/TOKEN FIX: Extract text from PDF once, convert it to standard text length
    if (config.resumeFile && config.resumeFile.mimeType === "application/pdf") {
      try {
        const buffer = Buffer.from(config.resumeFile.data, "base64");
        const parsed = await pdfParse(buffer);
        config.resume = parsed.text; // Store extracted text
        delete config.resumeFile; // Remove massive base64 blob to prevent token bloat
      } catch (err) {
        console.error("PDF Parsing failed attached to request, proceeding with raw datastream", err);
      }
    }

    const promptText = `
      Job Description: ${config.jobDescription}
      Resume: ${config.resume || (config.resumeFile ? "Provided as attached document" : "Not provided")}
      Summary: ${config.candidateSummary || "Not provided"}
      Target Round: ${config.targetRound || "General"}
      Experience Level: ${config.experienceLevel || "Not specified"}
      
      Based on this, generate a 3-person interview panel.
      Return a JSON object with:
      - skills: string[]
      - themes: string[]
      - panel: Array<{ name: string, role: string, persona: string, focus: string }>
    `;

    const parts: any[] = [{ text: promptText }];
    if (config.resumeFile) {
      parts.push({
        inlineData: {
          mimeType: config.resumeFile.mimeType,
          data: config.resumeFile.data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS.ROLE_ANALYZER,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            themes: { type: Type.ARRAY, items: { type: Type.STRING } },
            panel: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING, enum: ["RECRUITER", "HIRING_MANAGER", "DOMAIN_INTERVIEWER"] },
                  persona: { type: Type.STRING },
                  focus: { type: Type.STRING }
                },
                required: ["name", "role", "persona", "focus"]
              }
            }
          },
          required: ["skills", "themes", "panel"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    data.updatedConfig = config; // Send back parsed PDF config
    res.json(data);
  } catch (error: any) {
    console.error("API Analyze Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Next Response
app.post("/api/chat", async (req, res) => {
  try {
    const { interviewer, messages, config, interviewerFocus } = req.body;
    const transcript = messages.map((m: any) => `${m.senderName} (${m.senderRole}): ${m.text}`).join("\n");
    
    const promptText = `
      Current Transcript:
      ${transcript}
      
      You are the interviewer. It is your turn to speak. 
      If the candidate just answered, react briefly and ask your next question.
      If this is the beginning, introduce yourself and ask the first question.
      Keep responses concise and professional.
    `;

    const parts: any[] = [{ text: promptText }];
    if (config.resumeFile) {
      parts.push({
        inlineData: {
          mimeType: config.resumeFile.mimeType,
          data: config.resumeFile.data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS.INTERVIEWER(interviewer.name, interviewer.role, interviewer.persona, interviewerFocus),
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("API Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Generate Speech (TTS)
app.post("/api/speech", async (req, res) => {
  try {
    const { text, voiceName } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || "Kore" },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    res.json({ audioBase64: audioPart?.inlineData?.data || null });
  } catch (error: any) {
    console.error("API Speech Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Practice Feedback
app.post("/api/feedback", async (req, res) => {
  try {
    const { message, question } = req.body;
    const prompt = `
      Question Asked: "${question}"
      Candidate Answer: "${message}"
      
      You are an interview coach. Critically evaluate this specific answer.
      Provide a "Coach Tip" that helps the candidate improve:
      - Point out what was strong.
      - Identify what was missing.
      - Keep it brief (max 2 sentences).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS.PRACTICE_COACH,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("API Feedback Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Final Report
app.post("/api/report", async (req, res) => {
  try {
    const { messages, config } = req.body;
    const transcript = messages.map((m: any) => `${m.senderName}: ${m.text}`).join("\n");
    const parts: any[] = [{ text: `Evaluate this interview transcript:\n\n${transcript}` }];
    
    if (config.resumeFile) {
      parts.push({
        inlineData: {
          mimeType: config.resumeFile.mimeType,
          data: config.resumeFile.data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS.EVALUATION_COACH,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weakAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
            detailedFeedback: { type: Type.STRING },
            suggestedAnswers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  betterVersion: { type: Type.STRING }
                }
              }
            }
          },
          required: ["overallScore", "strengths", "weakAreas", "detailedFeedback", "suggestedAnswers"]
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("API Report Error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite middleware for development...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

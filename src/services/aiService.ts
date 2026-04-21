import { GoogleGenAI, Type, Modality } from "@google/genai";
import { InterviewConfig, IntervewParticipant, InterviewResult, Message } from "../types/interview";
import { SYSTEM_INSTRUCTIONS } from "../constants/prompts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export class AIService {
  static async analyzeInterviewContext(config: InterviewConfig) {
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

    return JSON.parse(response.text);
  }

  static async getNextInterviewerResponse(
    interviewer: IntervewParticipant,
    messages: Message[],
    config: InterviewConfig,
    interviewerFocus: string
  ) {
    const transcript = messages.map(m => `${m.senderName} (${m.senderRole}): ${m.text}`).join("\n");
    
    const promptText = `
      Current Transcript:
      ${transcript}
      
      You are the interviewer. It is your turn to speak. 
      If the candidate just answered, react briefly and ask your next question.
      If this is the beginning, introduce yourself and ask the first question.
      Keep responses concise and professional.
    `;

    const parts: any[] = [{ text: promptText }];
    
    // We optionally include the resume in every prompt so the interviewer can continue querying it
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

    return response.text;
  }

  static async generateSpeech(text: string, voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Kore') {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
      return audioPart?.inlineData?.data;
    } catch (err) {
      console.error("Gemini TTS API error:", err);
      return null;
    }
  }

  static async getPracticeFeedback(message: string, question: string) {
    const prompt = `
      Question Asked: "${question}"
      Candidate Answer: "${message}"
      
      You are an interview coach. Critically evaluate this specific answer.
      Provide a "Coach Tip" that helps the candidate improve:
      - Point out what was strong.
      - Identify what was missing (e.g., STAR method, more technical depth, better impact quantifiers).
      - Keep it brief (max 2 sentences).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional interview coach. Your goal is to help candidates land their dream job with actionable, immediate feedback.",
      }
    });

    return response.text;
  }

  static async generateFinalReport(messages: Message[], config: InterviewConfig): Promise<InterviewResult> {
    const transcript = messages.map(m => `${m.senderName}: ${m.text}`).join("\n");
    
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

    return JSON.parse(response.text);
  }
}

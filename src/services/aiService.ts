import { InterviewConfig, IntervewParticipant, InterviewResult, Message } from "../types/interview";

export class AIService {
  static async analyzeInterviewContext(config: InterviewConfig) {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config })
    });
    if (!response.ok) throw new Error("Failed to analyze interview context");
    return await response.json();
  }

  static async getNextInterviewerResponse(
    interviewer: IntervewParticipant,
    messages: Message[],
    config: InterviewConfig,
    interviewerFocus: string
  ) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewer, messages, config, interviewerFocus })
    });
    if (!response.ok) throw new Error("Failed to get next response");
    const data = await response.json();
    return data.text;
  }

  static async generateSpeech(text: string, voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Kore') {
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName })
      });
      if (!response.ok) throw new Error("Failed to generate speech");
      const data = await response.json();
      return data.audioBase64;
    } catch (err) {
      console.error("Gemini TTS API error via Backend:", err);
      return null;
    }
  }

  static async getPracticeFeedback(message: string, question: string) {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, question })
    });
    if (!response.ok) throw new Error("Failed to get feedback");
    const data = await response.json();
    return data.text;
  }

  static async generateFinalReport(messages: Message[], config: InterviewConfig): Promise<InterviewResult> {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, config })
    });
    if (!response.ok) throw new Error("Failed to generate final report");
    return await response.json();
  }
}

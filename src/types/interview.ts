export type InterviewMode = 'LIVE' | 'PRACTICE';

export interface IntervewParticipant {
  id: string;
  name: string;
  role: 'RECRUITER' | 'HIRING_MANAGER' | 'DOMAIN_INTERVIEWER';
  persona: string;
  avatar: string;
}

export interface InterviewConfig {
  jobDescription: string;
  resume?: string;
  candidateSummary?: string;
  portfolioLinks?: string[];
  targetRound?: string;
  experienceLevel?: string;
  focusAreas?: string[];
  mode: InterviewMode;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'INTERVIEWER' | 'CANDIDATE' | 'COACH';
  text: string;
  timestamp: number;
  feedback?: string; // Only for PRACTICE mode
}

export interface InterviewResult {
  overallScore: number;
  strengths: string[];
  weakAreas: string[];
  detailedFeedback: string;
  suggestedAnswers: { question: string; betterVersion: string }[];
}

export interface InterviewSession {
  id: string;
  config: InterviewConfig;
  startTime: number;
  messages: Message[];
  status: 'ANALYZING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED';
  currentInterviewerId?: string;
  panel: IntervewParticipant[];
}

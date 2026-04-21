import { useState } from "react";
import { InterviewConfig, InterviewSession, InterviewResult, Message } from "./types/interview";
import { ConfigurationForm } from "./components/ConfigurationForm";
import { InterviewCanvas } from "./components/InterviewCanvas";
import { FeedbackReport } from "./components/FeedbackReport";
import { AIService } from "./services/aiService";
import { motion, AnimatePresence } from "motion/react";
import { User, Briefcase, BarChart3, Layout } from "lucide-react";

export default function App() {
  const [step, setStep] = useState<'SETUP' | 'INTERVIEW' | 'REPORT'>('SETUP');
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [result, setResult] = useState<InterviewResult | null>(null);

  const startInterview = async (config: InterviewConfig) => {
    setStep('INTERVIEW');
    setSession({
      id: Math.random().toString(36).substr(2, 9),
      config,
      startTime: Date.now(),
      messages: [],
      status: 'ANALYZING',
      panel: []
    });

    try {
      const data = await AIService.analyzeInterviewContext(config);
      setSession(prev => prev ? {
        ...prev,
        config: data.updatedConfig || config, // Overwrite with server-modified config (dropping base64 file block)
        panel: data.panel.map((p: any) => ({ ...p, id: Math.random().toString(36).substr(2, 5), avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}` })),
        status: 'READY'
      } : null);
    } catch (error) {
      console.error("Failed to initialize interview", error);
    }
  };

  const endInterview = async (messages: Message[]) => {
    if (!session) return;
    setStep('REPORT');
    try {
      const report = await AIService.generateFinalReport(messages, session.config);
      setResult(report);
    } catch (error) {
      console.error("Failed to generate report", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shrink-0 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-600 text-white font-bold">
              I
            </div>
            <span className="text-xl font-bold tracking-tight uppercase text-slate-800">
              Intervū <span className="text-indigo-600">Sim</span>
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${step === 'SETUP' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <Briefcase size={14} />
              <span>Configure</span>
            </div>
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${step === 'INTERVIEW' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <User size={14} />
              <span>Interview</span>
            </div>
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${step === 'REPORT' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <BarChart3 size={14} />
              <span>Report</span>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-7xl h-full px-4 py-8 sm:px-6 lg:px-8 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'SETUP' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ConfigurationForm onSubmit={startInterview} />
            </motion.div>
          )}

          {step === 'INTERVIEW' && session && (
            <motion.div
              key="interview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
            >
              <InterviewCanvas 
                session={session} 
                onComplete={endInterview}
              />
            </motion.div>
          )}

          {step === 'REPORT' && (
            <motion.div
              key="report"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <FeedbackReport result={result} onReset={() => setStep('SETUP')} />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

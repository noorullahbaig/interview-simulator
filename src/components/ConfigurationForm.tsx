import { useState } from "react";
import { InterviewConfig } from "../types/interview";
import { Button, Input, Textarea, Card } from "./ui";
import { Briefcase, FileText, Link, Target, Zap } from "lucide-react";

export function ConfigurationForm({ onSubmit }: { onSubmit: (config: InterviewConfig) => void }) {
  const [config, setConfig] = useState<InterviewConfig>({
    jobDescription: "",
    resume: "",
    candidateSummary: "",
    portfolioLinks: [],
    targetRound: "Technical Interview",
    experienceLevel: "Senior",
    mode: "LIVE"
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 italic">Simulate. Succeed.</h1>
        <p className="text-slate-500">Construct your bespoke evaluation environment in seconds.</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Target size={14} />
            Target Job Description <span className="text-indigo-600">*</span>
          </label>
          <Textarea 
            placeholder="Paste the job description here..."
            className="h-40 bg-slate-50/50"
            value={config.jobDescription}
            onChange={(e) => setConfig({ ...config, jobDescription: e.target.value })}
            required
          />
        </div>

        <div className="space-y-4">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <FileText size={14} />
            Candidate Dossier (Resume/Summary)
          </label>
          <Textarea 
            placeholder="Paste your professional summary or full resume..."
            className="h-32 bg-slate-50/50"
            value={config.resume}
            onChange={(e) => setConfig({ ...config, resume: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Interview Stage</label>
            <Input 
              value={config.targetRound}
              onChange={(e) => setConfig({ ...config, targetRound: e.target.value })}
              className="bg-slate-50/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Seniority Level</label>
            <Input 
              value={config.experienceLevel}
              onChange={(e) => setConfig({ ...config, experienceLevel: e.target.value })}
              className="bg-slate-50/50"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 block">Simulation Protocol</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setConfig({ ...config, mode: 'LIVE' })}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${config.mode === 'LIVE' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'}`}
            >
              <Zap size={22} className={config.mode === 'LIVE' ? 'text-indigo-600' : 'text-slate-300'} />
              <div className="text-center font-bold text-sm">Live Interview</div>
              <p className="text-[10px] opacity-70 font-medium">Real-time pressure, no assistance.</p>
            </button>
            <button
              onClick={() => setConfig({ ...config, mode: 'PRACTICE' })}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${config.mode === 'PRACTICE' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'}`}
            >
              <Zap size={22} className={config.mode === 'PRACTICE' ? 'text-indigo-600' : 'text-slate-300'} />
              <div className="text-center font-bold text-sm">Practice Mode</div>
              <p className="text-[10px] opacity-70 font-medium">Interactive hints and live coaching.</p>
            </button>
          </div>
        </div>

        <Button 
          disabled={!config.jobDescription}
          className="w-full h-14 text-base font-bold uppercase tracking-widest gap-3 rounded-xl bg-slate-900 hover:bg-slate-800"
          onClick={() => onSubmit(config)}
        >
          Initialize Simulator
          <Briefcase size={20} />
        </Button>
      </Card>
    </div>
  );
}

import { InterviewResult } from "../types/interview";
import { Card, Button } from "./ui";
import { Award, TrendingUp, AlertCircle, RotateCcw, Share2, Star, BarChart3 } from "lucide-react";
import Markdown from "react-markdown";
import { motion } from "motion/react";

export function FeedbackReport({ result, onReset }: { result: InterviewResult | null; onReset: () => void }) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-6 text-center h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin" />
          <Bot size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Generating Report</h2>
          <p className="text-zinc-500">Analyzing your performance across the entire session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header Stat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 bg-slate-900 text-white md:col-span-1 flex flex-col items-center justify-center text-center space-y-6">
          <div className="text-slate-400 uppercase text-[10px] font-bold tracking-[0.2em]">Dossier Evaluation</div>
          <div className="relative">
            <svg className="w-36 h-36 transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="66"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                className="text-slate-800"
              />
              <circle
                cx="72"
                cy="72"
                r="66"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={414.69}
                strokeDashoffset={414.69 - (414.69 * result.overallScore) / 100}
                className="text-indigo-400 transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black italic tracking-tighter leading-none">{result.overallScore}</span>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Percentile</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} size={12} className={s <= Math.ceil(result.overallScore / 20) ? "fill-indigo-400 text-indigo-400" : "text-slate-700"} />
            ))}
          </div>
        </Card>

        <Card className="p-8 md:col-span-2 space-y-4 bg-white border-slate-200">
           <h3 className="font-bold flex items-center gap-2 text-slate-800 uppercase text-xs tracking-widest">
             <BarChart3 size={16} className="text-indigo-600" />
             Strategic Performance Summary
           </h3>
           <div className="prose prose-sm text-slate-600 leading-relaxed max-w-none">
             <Markdown>{result.detailedFeedback}</Markdown>
           </div>
        </Card>
      </div>

      {/* Strengths & Weak Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border-emerald-100 bg-emerald-50/20">
          <h3 className="font-bold flex items-center gap-2 text-emerald-900 mb-4 uppercase text-[11px] tracking-widest">
            <Award size={16} />
            Key Competencies
          </h3>
          <ul className="space-y-3">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-emerald-800 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 border-amber-100 bg-amber-50/20">
          <h3 className="font-bold flex items-center gap-2 text-amber-900 mb-4 uppercase text-[11px] tracking-widest">
            <AlertCircle size={16} />
            Optimization Paths
          </h3>
          <ul className="space-y-3">
            {result.weakAreas.map((w, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-amber-800 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Suggested Answers */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold px-1 uppercase tracking-[0.2em] text-slate-400">Tactical Refinements</h3>
        <div className="space-y-4">
          {result.suggestedAnswers.map((item, i) => (
            <Card key={i} className="p-6 pb-8 space-y-4 overflow-hidden relative border-slate-200">
              <div className="absolute top-0 right-0 p-3 bg-slate-50 border-l border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Correction Unit 0{i+1}
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center shrink-0 font-bold text-[10px] text-slate-500">Q</div>
                  <p className="text-sm font-bold text-slate-800 pr-16 leading-tight">{item.question}</p>
                </div>
                <div className="flex gap-3">
                   <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center shrink-0 font-bold text-[10px] text-white italic">A</div>
                   <div className="p-4 bg-indigo-50/50 rounded-xl rounded-tl-none text-slate-700 text-sm leading-relaxed border border-indigo-50 font-medium">
                    <Markdown>{item.betterVersion}</Markdown>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex gap-4 pt-12 items-center justify-center">
        <Button onClick={onReset} className="w-64 gap-2 h-14 rounded-full bg-slate-900 hover:bg-slate-800 shadow-xl font-bold uppercase tracking-widest text-xs">
          <RotateCcw size={16} />
          New Simulation
        </Button>
        <Button variant="outline" className="w-64 gap-2 h-14 rounded-full border-slate-200 font-bold uppercase tracking-widest text-xs hover:bg-slate-100">
          <Share2 size={16} />
          Export Report
        </Button>
      </div>
    </div>
  );
}

function Bot(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

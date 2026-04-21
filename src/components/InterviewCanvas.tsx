import { useState, useRef, useEffect } from "react";
import { InterviewSession, Message } from "../types/interview";
import { AIService } from "../services/aiService";
import { Button } from "./ui";
import { 
  Send, User, Bot, Loader2, Info, Mic, MicOff, 
  Volume2, VolumeX, Video, VideoOff, PhoneOff, 
  MessageSquare, Maximize2, LayoutGrid 
} from "lucide-react";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";

export function InterviewCanvas({ session, onComplete }: { session: InterviewSession; onComplete: (messages: Message[]) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentInterviewerIndex, setCurrentInterviewerIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muteOutput, setMuteOutput] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const voices: ('Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr')[] = ['Kore', 'Zephyr', 'Fenrir', 'Charon'];

  // Initialize and resume Audio on Join
  const handleJoinConference = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    setIsJoined(true);
    if (messages.length === 0) {
      triggerInterviewerResponse();
    }
  };

  // Camera Management
  useEffect(() => {
    async function setupCamera() {
      if (isVideoOn && isJoined) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        } catch (err) {
          console.error("Camera access denied", err);
          setIsVideoOn(false);
        }
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      }
    }
    setupCamera();
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [isVideoOn, isJoined]);

  useEffect(() => {
    if (session.status === 'READY' && messages.length === 0 && isJoined) {
      triggerInterviewerResponse();
    }
  }, [session.status, isJoined]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, showChat]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript) {
          setInputValue(prev => prev + " " + transcript);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setInputValue("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const playSpeech = async (text: string, voiceName: any) => {
    if (muteOutput || !isJoined) return;

    const fallbackToBrowserTTS = () => {
      console.log("Using browser TTS fallback...");
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      
      // Try to find a reasonable voice
      const selectedVoice = voices.find(v => v.name.includes('Google') || v.lang === 'en-US') || voices[0];
      if (selectedVoice) utterance.voice = selectedVoice;
      
      utterance.rate = 1.05;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    };

    try {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      setIsSpeaking(true);
      const base64Audio = await AIService.generateSpeech(text, voiceName);
      
      if (!base64Audio) {
        fallbackToBrowserTTS();
        return;
      }

      // Try playing as Data URI first (most browser-compatible for Gemini's output)
      const dataUri = `data:audio/wav;base64,${base64Audio}`;
      const audio = new Audio(dataUri);
      
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = (e) => {
        console.warn("Audio element playback failed, trying AudioContext decoding...", e);
        // Fallback to AudioContext if Audio element rejects it (e.g. format issues)
        decodeAndPlayViaContext(base64Audio).catch((err) => {
           console.error("AudioContext decoding also failed", err);
           fallbackToBrowserTTS();
        });
      };

      try {
        await audio.play();
      } catch (err) {
        console.warn("Audio element play() rejected:", err);
        fallbackToBrowserTTS();
      }

    } catch (err) {
      console.error("Failed to play speech entirely", err);
      fallbackToBrowserTTS();
    }
  };

  const decodeAndPlayViaContext = async (base64Audio: string) => {
    if (!audioContextRef.current) throw new Error("No AudioContext");
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => setIsSpeaking(false);
    source.start(0);
  };

  const triggerInterviewerResponse = async (currentMessages = messages) => {
    if (session.panel.length === 0) return;
    
    setIsTyping(true);
    const interviewer = session.panel[currentInterviewerIndex];
    
    try {
      const text = await AIService.getNextInterviewerResponse(interviewer, currentMessages, session.config, interviewer.persona);
      const newMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: interviewer.id,
        senderName: interviewer.name,
        senderRole: 'INTERVIEWER',
        text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, newMessage]);
      
      const voiceName = voices[currentInterviewerIndex % voices.length];
      playSpeech(text, voiceName);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: 'candidate',
      senderName: 'You',
      senderRole: 'CANDIDATE',
      text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    if (isListening) recognitionRef.current?.stop();

    setIsTyping(true);
    
    try {
      let feedback = undefined;
      if (session.config.mode === 'PRACTICE') {
        const lastInterviewerMsg = [...messages].reverse().find(m => m.senderRole !== 'CANDIDATE');
        feedback = await AIService.getPracticeFeedback(text, lastInterviewerMsg?.text || "");
        setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, feedback } : m));
        if (feedback && !muteOutput) playSpeech(feedback, 'Puck');
      }

      if (feedback) await new Promise(r => setTimeout(r, 1500));

      const nextInterviewerIndex = messages.filter(m => m.senderRole === 'CANDIDATE').length % 2 === 1 
        ? (currentInterviewerIndex + 1) % session.panel.length 
        : currentInterviewerIndex;
      
      setCurrentInterviewerIndex(nextInterviewerIndex);
      
      setTimeout(() => {
        triggerInterviewerResponse([...messages, userMessage]);
      }, 1000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const currentSpeakerMsg = messages[messages.length - 1];

  return (
    <div className="relative h-full flex flex-col bg-slate-950 text-white rounded-3xl overflow-hidden shadow-2xl border border-white/5">
      {/* Waiting Room Overlay */}
      <AnimatePresence>
        {!isJoined && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
              <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-500/20 rotate-3">
                <Video size={40} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Ready to join?</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-10">
                The interview panel is waiting for you. <br/>
                Click below to initialize your secure video connection and audio link.
              </p>
              
              <div className="space-y-4">
                <button 
                  onClick={handleJoinConference}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-16 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95"
                >
                  Join Conference
                </button>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                  Encrypted Peer-to-Peer Connection
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Badge */}
      <div className="absolute top-6 left-8 z-30 flex items-center gap-4">
        <div className="flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-red-600/20">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
          Live Connection
        </div>
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest text-zinc-400">
           {session.config.targetRound || "Assessment Round"}
        </div>
      </div>

      {/* Floating Buttons */}
      <div className="absolute top-6 right-8 z-30 flex items-center gap-3">
        <button 
          onClick={() => setShowChat(!showChat)}
          className={`p-3 rounded-full border transition-all ${showChat ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
        >
          <MessageSquare size={18} />
        </button>
      </div>

      {/* Grid of Participants */}
      <div className="flex-1 relative flex overflow-hidden">
        <div className={`flex-1 p-8 grid grid-cols-1 md:grid-cols-2 ${session.panel.length > 2 ? 'lg:grid-cols-2 xl:grid-cols-2' : ''} gap-6 transition-all duration-500`}>
          {/* Interviewer Frames */}
          {session.panel.map((p, idx) => (
            <motion.div 
               key={p.id}
               className={`relative aspect-video rounded-3xl overflow-hidden bg-slate-900 border-2 transition-all duration-700 ${
                 currentInterviewerIndex === idx && isSpeaking 
                  ? 'border-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.2)]' 
                  : 'border-white/5 grayscale-[40%]'
               }`}
            >
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900">
                <div className="relative">
                  <img 
                    src={p.avatar} 
                    className={`w-32 h-32 rounded-full border-4 transition-all duration-500 object-cover ${
                      currentInterviewerIndex === idx && isSpeaking ? 'scale-110 border-indigo-500' : 'border-slate-800'
                    }`} 
                    referrerPolicy="no-referrer"
                  />
                  {currentInterviewerIndex === idx && isSpeaking && (
                    <div className="absolute -inset-4 border-2 border-indigo-500/50 rounded-full animate-ping pointer-events-none"></div>
                  )}
                </div>
              </div>

              {/* Identity Overlay */}
              <div className="absolute bottom-6 left-6 flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 p-3 rounded-2xl">
                 <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                    <User size={14} className="text-slate-400" />
                 </div>
                 <div>
                    <p className="text-xs font-bold text-white">{p.name}</p>
                    <p className="text-[10px] font-medium text-indigo-400 capitalize">{p.role.toLowerCase().replace('_', ' ')}</p>
                 </div>
              </div>

              {/* Speak Indicator */}
              {currentInterviewerIndex === idx && isSpeaking && (
                 <div className="absolute top-6 right-6 flex gap-1 items-end h-6 pb-1">
                    <div className="w-1 h-3 bg-indigo-500 animate-bounce"></div>
                    <div className="w-1 h-5 bg-indigo-400 animate-bounce [animation-delay:0.1s]"></div>
                    <div className="w-1 h-4 bg-indigo-500 animate-bounce [animation-delay:0.2s]"></div>
                 </div>
              )}
            </motion.div>
          ))}

          {/* User View Frame */}
          <div className={`relative aspect-video rounded-3xl overflow-hidden bg-slate-900 border-2 transition-all duration-700 ${isListening ? 'border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 'border-white/5'}`}>
             {isVideoOn ? (
               <video 
                 ref={videoRef}
                 autoPlay
                 muted
                 playsInline
                 className="w-full h-full object-cover scale-x-[-1]"
               />
             ) : (
               <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 space-y-4">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 text-slate-600">
                    <User size={48} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Camera Disabled</p>
               </div>
             )}

             <div className="absolute bottom-6 left-6 flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 p-3 rounded-2xl">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isListening ? 'bg-red-600 animate-pulse' : 'bg-slate-800'}`}>
                    <Mic size={14} className={isListening ? 'text-white' : 'text-slate-400'} />
                 </div>
                 <p className="text-xs font-bold text-white">You (Candidate)</p>
             </div>
          </div>
        </div>

        {/* Floating Captions */}
        <AnimatePresence>
          {!showChat && isSpeaking && currentSpeakerMsg && currentSpeakerMsg.senderRole !== 'CANDIDATE' && (
             <motion.div 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 30 }}
               className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-3xl px-8 z-40 text-center"
             >
               <div className="bg-black/80 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl shadow-2xl">
                  <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">{currentSpeakerMsg.senderName}</p>
                  <p className="text-xl font-medium leading-relaxed text-zinc-100">
                    &ldquo;{currentSpeakerMsg.text}&rdquo;
                  </p>
               </div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar Transcript */}
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              className="w-[400px] bg-slate-900/50 backdrop-blur-3xl border-l border-white/10 flex flex-col h-full z-50 shadow-2xl"
            >
               <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare size={18} className="text-slate-400" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Meeting Log</h4>
                  </div>
                  <button onClick={() => setShowChat(false)} className="text-slate-500 hover:text-white transition-colors">
                    <Maximize2 size={16} />
                  </button>
               </div>
               <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {messages.map(m => (
                    <motion.div 
                      key={m.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex flex-col ${m.senderRole === 'CANDIDATE' ? 'items-end' : 'items-start'}`}
                    >
                      <p className="text-[10px] font-bold text-zinc-500 mb-1.5 tracking-tighter uppercase">{m.senderName}</p>
                      <div className={`p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${m.senderRole === 'CANDIDATE' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-zinc-300 rounded-tl-none'}`}>
                        <Markdown>{m.text}</Markdown>
                      </div>
                      {m.feedback && (
                        <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-[11px] text-emerald-400 leading-snug">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Bot size={12} />
                            <span className="font-bold uppercase tracking-tighter">Evaluation Insight</span>
                          </div>
                          {m.feedback}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-2 p-4 bg-slate-800/50 rounded-2xl w-16">
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                    </div>
                  )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Bar */}
      <div className="h-28 bg-slate-950 border-t border-white/5 flex items-center justify-between px-10 relative z-[60] bg-gradient-to-t from-slate-950 to-slate-900/50">
        <div className="flex items-center gap-2 text-slate-500">
           <LayoutGrid size={16} />
           <span className="text-[11px] font-bold uppercase tracking-tighter">Conference Gallery</span>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-5">
          <button 
             onClick={toggleListening}
             className={`group w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all ${isListening ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5'}`}
          >
             {isListening ? <Mic size={24} /> : <MicOff size={24} />}
             <span className="absolute -bottom-8 text-[9px] font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Audio</span>
          </button>

          <button 
             onClick={() => setIsVideoOn(!isVideoOn)}
             className={`group w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all ${isVideoOn ? 'bg-white/5 hover:bg-white/10 text-white border border-white/5' : 'bg-red-900/20 text-red-500 border border-red-500/30'}`}
          >
             {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
             <span className="absolute -bottom-8 text-[9px] font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Video</span>
          </button>

          <div className="w-px h-10 bg-white/10 shrink-0"></div>

          <button 
             onClick={() => setMuteOutput(!muteOutput)}
             className={`group w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all ${muteOutput ? 'bg-orange-900/20 text-orange-500 border border-orange-500/30' : 'bg-white/5 hover:bg-white/10 text-white border border-white/5'}`}
          >
             {muteOutput ? <VolumeX size={24} /> : <Volume2 size={24} />}
             <span className="absolute -bottom-8 text-[9px] font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Speaker</span>
          </button>

          <button 
             onClick={() => {
               if(confirm("End simulation and view executive summary?")) {
                 onComplete(messages);
               }
             }}
             className="ml-4 px-8 h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex items-center gap-3 shadow-xl transition-all active:scale-95 group relative"
          >
             <PhoneOff size={20} />
             <span className="text-xs font-black uppercase tracking-widest">End Session</span>
          </button>
        </div>

        {/* Text Area */}
        <div className="w-80 relative flex items-center">
            <input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Send a private note..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
            />
            <button 
              disabled={!inputValue.trim() || isTyping}
              onClick={handleSendMessage}
              className="absolute right-2 p-2 bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Send size={16} />
            </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/geminiService.ts';
import { ChatMessage, Task } from '../types.ts';
import { storageService } from '../services/storageService.ts';

interface ChatInterfaceProps {
  onTasksGenerated: (newTasks: any[]) => void;
  existingTasks: Task[];
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  isOffline?: boolean;
}

/* ─────────────────────────────────────────────────────────────
   PREVIOUS VERSION (easy revert) — uncomment & replace JSX below
   to restore the old flat-panel look.

   OLD JSX (root div):
   <div className="flex flex-col h-full bg-slate-800/50 rounded-2xl border border-blue-500/20 overflow-hidden backdrop-blur-sm">
     <div className="p-4 bg-blue-600/20 border-b border-blue-500/20 flex items-center gap-2">
       <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
       <h3 className="font-semibold text-blue-100">Lumina AI Assistant</h3>
     </div>
     ...messages / input unchanged...
   </div>
───────────────────────────────────────────────────────────────── */

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onTasksGenerated,
  existingTasks,
  messages,
  onSendMessage,
  isLoading,
  isOffline = false
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const content = input;
    setInput('');
    await onSendMessage(content);
  };

  return (
    <div
      className="flex flex-col h-full rounded-3xl overflow-hidden relative"
      style={{
        background: 'rgba(10, 16, 36, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.4)',
      }}
    >
      {/* Subtle gradient top accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-white/5">
        <div className="relative">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a1024] ${isOffline ? 'bg-slate-500' : 'bg-emerald-400 animate-pulse'}`} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">Lumina</h3>
          <p className="text-[10px] text-blue-400/70 font-semibold uppercase tracking-widest">AI Planning Assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'text-white rounded-2xl rounded-tr-sm'
                  : 'text-slate-200 rounded-2xl rounded-tl-sm'
              }`}
              style={
                m.role === 'user'
                  ? {
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.7), rgba(99,102,241,0.7))',
                      border: '1px solid rgba(99,102,241,0.3)',
                      backdropFilter: 'blur(8px)',
                    }
                  : {
                      background: 'rgba(30,41,59,0.6)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      backdropFilter: 'blur(8px)',
                    }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5"
              style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input / Offline Notice */}
      <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3">
        {isOffline ? (
          <div
            className="rounded-xl px-5 py-6 flex items-center justify-center gap-4 animate-in slide-in-from-bottom-2 duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.05))',
              border: '1px solid rgba(59,130,246,0.2)',
              boxShadow: 'inset 0 0 20px rgba(59,130,246,0.05)'
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9"></path>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-blue-300 tracking-wide">No Internet Connection</p>
              <p className="text-xs text-blue-400/60 mt-1 font-medium">Reconnecting... AI features are currently unavailable.</p>
            </div>
          </div>
        ) : (
          <>
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(59,130,246,0.2)',
                boxShadow: '0 0 0 3px rgba(59,130,246,0.04)',
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Drop your agenda or ask anything..."
                className="w-full bg-transparent text-slate-200 text-sm py-3.5 pl-4 pr-12 outline-none resize-none placeholder:text-slate-600"
                rows={2}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="absolute right-3 bottom-3 p-2 rounded-xl transition-all duration-200"
                style={{
                  background: input.trim() && !isLoading
                    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                    : 'rgba(30,41,59,0.8)',
                  boxShadow: input.trim() && !isLoading ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={input.trim() && !isLoading ? 'text-white' : 'text-slate-600'}>
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
            <p className="mt-2 text-[10px] text-slate-600 text-center tracking-wider">Shift+Enter for new line</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
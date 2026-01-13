import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/geminiService.ts';
import { ChatMessage, Task } from '../types.ts';
import { storageService } from '../services/storageService.ts';

interface ChatInterfaceProps {
  onTasksGenerated: (newTasks: any[]) => void;
  existingTasks: Task[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onTasksGenerated, existingTasks }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm Lumina. Drop your rough agenda here, and I'll turn it into an organized checklist for you.", timestamp: new Date().toISOString() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const lowercaseInput = input.toLowerCase();
      const isAgendaRequest = lowercaseInput.includes('agenda') || 
                             lowercaseInput.includes('tasks') || 
                             lowercaseInput.includes('plan') ||
                             input.length > 50;

      if (isAgendaRequest) {
        const newTasksData = await geminiService.processAgenda(input);
        if (newTasksData && newTasksData.length > 0) {
          onTasksGenerated(newTasksData);
          const assistantMsg: ChatMessage = { 
            role: 'assistant', 
            content: `I've analyzed your notes and generated ${newTasksData.length} new tasks for you! Check them out in your task board.`, 
            timestamp: new Date().toISOString() 
          };
          setMessages(prev => [...prev, assistantMsg]);
        } else {
          throw new Error("No tasks extracted");
        }
      } else {
        const reply = await geminiService.getChatResponse(input, existingTasks);
        const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (error) {
      const errorMsg: ChatMessage = { 
        role: 'assistant', 
        content: "I'm sorry, I had trouble processing that. Could you try rephrasing your agenda?", 
        timestamp: new Date().toISOString() 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-2xl border border-blue-500/20 overflow-hidden backdrop-blur-sm">
      <div className="p-4 bg-blue-600/20 border-b border-blue-500/20 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
        <h3 className="font-semibold text-blue-100">Lumina AI Assistant</h3>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-700 text-slate-100 rounded-tl-none border border-slate-600'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 p-3 rounded-2xl rounded-tl-none border border-slate-600 space-x-1 flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-blue-500/20 bg-slate-900/50">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Paste your rough agenda or chat..."
            className="w-full bg-slate-800 text-slate-100 text-sm rounded-xl py-3 pl-4 pr-12 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
            rows={2}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-3 bottom-3 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-500 text-center uppercase tracking-wider font-semibold">Shift + Enter for new line</p>
      </div>
    </div>
  );
};

export default ChatInterface;
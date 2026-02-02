import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Reorder } from 'framer-motion';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { Task, PlannerState, ChatMessage } from './types';
import ChatInterface from './components/ChatInterface';
import TaskCard from './components/TaskCard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CalendarPicker from './components/CalendarPicker';

const App: React.FC = () => {
  const [state, setState] = useState<PlannerState>({
    tasks: [],
    userName: 'User',
    dailyMission: '',
    chatHistory: {}
  });

  const [isChatLoading, setIsChatLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'board' | 'analytics'>('board');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isEditingMission, setIsEditingMission] = useState(false);
  const [tempMission, setTempMission] = useState('');

  /** 🔒 Prevents saving during initial hydration */
  const hasHydratedRef = useRef(false);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  /* =========================
     App Exit (Ctrl+Q / Button)
     ========================= */
  const handleExit = async () => {
    try {
      await storageService.saveState(state);
    } catch (e) {
      console.error('Failed to save before exit:', e);
    }

    try {
      const electron = (window as any).require?.('electron');
      electron?.ipcRenderer?.send('quit-app');
    } catch {
      // ignore if not in Electron
    }
  };

  /* =========================
     Initial Load (Hydration)
     ========================= */
  useEffect(() => {
    const saved = storageService.loadState();
    setState(saved);

    // ✅ Mark hydration complete immediately
    hasHydratedRef.current = true;

    // Fetch Gemini inspiration only if none exists
    if (!saved.dailyMission) {
      (async () => {
        try {
          const prompt = await geminiService.getDailyInspiration();
          setState(prev => ({
            ...prev,
            dailyMission: prompt?.replace(/"/g, '') || 'Make today count.'
          }));
        } catch {
          setState(prev => ({ ...prev, dailyMission: 'Seize the day.' }));
        }
      })();
    }

    // Ctrl+Q handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* =========================
     Persistence (SAFE)
     ========================= */
  useEffect(() => {
    if (!hasHydratedRef.current) return; // ⛔ no startup overwrite

    storageService.saveState(state).catch(err =>
      console.error('Auto-save failed:', err)
    );
  }, [state]);

  /* =========================
     Task Handlers
     ========================= */
  const handleTasksGenerated = useCallback(
    (newTasksData: any[]) => {
      const tasksToAdd: Task[] = newTasksData.map(data => ({
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description || 'No description provided.',
        category: data.category || 'General',
        priority: data.priority || 'medium',
        completed: false,
        rating: null,
        createdAt: new Date().toISOString(),
        date: selectedDate
      }));

      setState(prev => ({
        ...prev,
        tasks: [...tasksToAdd, ...prev.tasks]
      }));
    },
    [selectedDate]
  );

  const toggleTask = (id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === id
          ? {
            ...t,
            completed: !t.completed,
            completedAt: !t.completed ? new Date().toISOString() : undefined
          }
          : t
      )
    }));
  };

  const rateTask = (id: string, rating: number) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        t.id === id ? { ...t, rating } : t
      )
    }));
  };

  /* =========================
     Reorder Logic
     ========================= */
  const handleReorder = (newOrder: Task[]) => {
    setState(prev => {
      // 1. Separate tasks
      const otherDateTasks = prev.tasks.filter(t => t.date !== selectedDate);
      const currentDateTasks = prev.tasks.filter(t => t.date === selectedDate);

      // 2. Identify indices of items in `newOrder` within `currentDateTasks`
      // (We only move items that are currently visible/filtered)
      const originalIndices = new Map<string, number>();
      currentDateTasks.forEach((t, i) => originalIndices.set(t.id, i));

      // 3. Get the stable slots/indices that these items occupied
      // We process only items that exist in both lists (sanity check)
      const validItems = newOrder.filter(t => originalIndices.has(t.id));
      const slots = validItems.map(t => originalIndices.get(t.id)!).sort((a, b) => a - b);

      // 4. Fill those slots with the items in their new relative order
      const newCurrentDateTasks = [...currentDateTasks];
      slots.forEach((slot, i) => {
        newCurrentDateTasks[slot] = validItems[i];
      });

      return {
        ...prev,
        tasks: [...otherDateTasks, ...newCurrentDateTasks]
      };
    });
  };

  const deleteTask = (id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id)
    }));
  };

  /* =========================
     Mission Editing
     ========================= */
  const startEditingMission = () => {
    setTempMission(state.dailyMission || '');
    setIsEditingMission(true);
  };

  const saveMission = () => {
    setState(prev => ({ ...prev, dailyMission: tempMission }));
    setIsEditingMission(false);
  };

  /* =========================
     Date & Filtering
     ========================= */
  const navigateDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const filteredTasks = state.tasks.filter(t => {
    if (t.date !== selectedDate) return false;
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const isToday =
    selectedDate === new Date().toISOString().split('T')[0];

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  /* =========================
     Chat Logic
     ========================= */
  const handleSendMessage = async (content: string) => {
    setIsChatLoading(true);
    const today = new Date().toISOString();

    // 1. Construct User Message
    const userMsg: ChatMessage = {
      role: 'user',
      content,
      timestamp: today
    };

    // 2. Optimistic Update (preserve welcome msg if starting new)
    setState(prev => {
      const currentHistory = prev.chatHistory[selectedDate] || [];
      // If history is empty, assume we want to keep the "Hi" message that was shown
      const historyToUse = currentHistory.length === 0
        ? [{ role: 'assistant' as const, content: "Hi! I'm Lumina. Drop your rough agenda here, and I'll turn it into an organized checklist for you.", timestamp: today }]
        : currentHistory;

      return {
        ...prev,
        chatHistory: {
          ...prev.chatHistory,
          [selectedDate]: [...historyToUse, userMsg]
        }
      };
    });

    try {
      const lowercaseInput = content.toLowerCase();
      const isAgendaRequest = lowercaseInput.includes('agenda') ||
        lowercaseInput.includes('tasks') ||
        lowercaseInput.includes('plan') ||
        content.length > 50;

      let replyContent = '';

      if (isAgendaRequest) {
        const newTasksData = await geminiService.processAgenda(content);
        if (newTasksData && newTasksData.length > 0) {
          handleTasksGenerated(newTasksData);
          replyContent = `I've analyzed your notes and generated ${newTasksData.length} new tasks for you! Check them out in your task board.`;
        } else {
          throw new Error("No tasks extracted");
        }
      } else {
        replyContent = await geminiService.getChatResponse(content, state.tasks); // Pass all tasks for context
      }

      // 3. Add Assistant Response
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toISOString()
      };

      setState(prev => ({
        ...prev,
        chatHistory: {
          ...prev.chatHistory,
          [selectedDate]: [...(prev.chatHistory[selectedDate] || []), assistantMsg]
        }
      }));

    } catch (error) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: "I'm sorry, I had trouble processing that. Could you try rephrasing your agenda?",
        timestamp: new Date().toISOString()
      };

      setState(prev => ({
        ...prev,
        chatHistory: {
          ...prev.chatHistory,
          [selectedDate]: [...(prev.chatHistory[selectedDate] || []), errorMsg]
        }
      }));
    } finally {
      setIsChatLoading(false);
    }
  };

  // Safe accessor for chat history
  const currentChatMessages = state.chatHistory?.[selectedDate]?.length
    ? state.chatHistory[selectedDate]
    : [{ role: 'assistant' as const, content: "Hi! I'm Lumina. Drop your rough agenda here, and I'll turn it into an organized checklist for you.", timestamp: new Date().toISOString() }];

  return (
    <div className="min-h-screen flex flex-col bg-[#020617] text-slate-100 selection:bg-blue-500/30">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
      </div>

      <nav className="sticky top-0 z-50 glass-panel border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Lumina Planner
              </h1>
              <p className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Personal Focus Hub</p>
            </div>
          </div>

          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 gap-1">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'board' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              My Board
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Insights
            </button>
            <button
              onClick={() => {
                try {
                  (window as any).require?.('electron')?.ipcRenderer?.send('minimize-app');
                } catch { }
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all duration-300"
              title="Minimize"
            >
              _
            </button>
            <button
              onClick={handleExit}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
              title="Exit application (Ctrl+Q)"
            >
              ✕
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className={`${activeTab === 'board' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-8`}>
          {activeTab === 'board' ? (
            <>
              <div className="relative group rounded-3xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-10 group-hover:opacity-15 transition-opacity"></div>
                <div className="relative p-8 border border-white/5 glass-panel">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 opacity-80">Daily Mission</span>
                        {!isEditingMission && (
                          <button
                            onClick={startEditingMission}
                            className="text-[10px] text-slate-500 hover:text-blue-400 uppercase tracking-widest font-bold transition-colors"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {isEditingMission ? (
                        <div className="flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                          <textarea
                            autoFocus
                            value={tempMission}
                            onChange={(e) => setTempMission(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                saveMission();
                              }
                            }}
                            className="w-full bg-slate-900/50 border border-blue-500/30 rounded-xl p-3 text-lg md:text-xl font-medium text-white outline-none focus:ring-1 focus:ring-blue-500"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setIsEditingMission(false)}
                              className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveMission}
                              className="px-4 py-1.5 bg-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <h2
                          onClick={startEditingMission}
                          className="text-xl md:text-2xl font-semibold text-white/90 italic tracking-tight leading-relaxed cursor-pointer hover:text-white transition-colors group-hover:translate-x-1 transition-transform"
                        >
                          "{state.dailyMission || 'Define your focus for today...'}"
                        </h2>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 bg-slate-900/50 rounded-xl p-1.5 border border-white/5">
                    <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-blue-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                        className="text-sm font-bold px-4 text-slate-200 min-w-[150px] text-center hover:text-blue-400 transition-colors"
                      >
                        {isToday ? "Today, " + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : formattedDate}
                      </button>
                      {isCalendarOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsCalendarOpen(false)}></div>
                          <CalendarPicker
                            selectedDate={selectedDate}
                            onSelectDate={setSelectedDate}
                            tasks={state.tasks}
                            onClose={() => setIsCalendarOpen(false)}
                          />
                        </>
                      )}
                    </div>
                    <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-blue-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5">
                  {(['all', 'pending', 'completed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${filter === f ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <Reorder.Group
                axis="y"
                values={filteredTasks}
                onReorder={handleReorder}
                className="grid grid-cols-1 gap-5"
              >
                {filteredTasks.length > 0 ? (
                  filteredTasks.map(task => (
                    <Reorder.Item
                      key={task.id}
                      value={task}
                      className="relative"
                    >
                      <TaskCard
                        task={task}
                        onToggle={toggleTask}
                        onRate={rateTask}
                        onDelete={deleteTask}
                      />
                    </Reorder.Item>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-white/5 text-slate-500 group hover:border-blue-500/20 transition-colors">
                    <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <h3 className="text-slate-300 font-semibold mb-1">Clear Horizon</h3>
                    <p className="text-sm opacity-60">No tasks for this day. Ready to plan some?</p>
                  </div>
                )}
              </Reorder.Group>
            </>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mb-10">
                <h2 className="text-4xl font-black text-white tracking-tight mb-2">Your Velocity</h2>
                <p className="text-slate-500 text-lg">Visualizing your progress over the last few weeks.</p>
              </div>
              <AnalyticsDashboard tasks={state.tasks} />
            </div>
          )}
        </div>

        {activeTab === 'board' && (
          <div className="lg:col-span-4 lg:sticky lg:top-28 h-[calc(100vh-10rem)]">
            <ChatInterface
              onTasksGenerated={handleTasksGenerated}
              existingTasks={state.tasks}
              messages={currentChatMessages}
              onSendMessage={handleSendMessage}
              isLoading={isChatLoading}
            />
          </div>
        )}
      </main>

      <footer className="mt-auto py-12 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10"></div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">Lumina Core v1.3</span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10"></div>
        </div>
        <p className="text-slate-500 text-xs">Crafted for personal excellence.</p>
      </footer>
    </div>
  );
};

export default App;
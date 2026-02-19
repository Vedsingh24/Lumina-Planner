import React, { useState } from 'react';
import { Task, Priority } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
  onRate: (id: string, rating: number) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  activeDropdown: 'priority' | 'category' | null;
  onSetActiveDropdown: (type: 'priority' | 'category' | null) => void;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const CATEGORIES = ['General', 'Work', 'Personal', 'Health', 'Finance', 'Learning'];

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onRate, onDelete, onUpdate }) => {
  const [activeDropdown, setActiveDropdown] = useState<'priority' | 'category' | null>(null);

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className={`group relative p-4 rounded-xl border transition-all duration-300 ${task.completed
      ? 'bg-slate-800/40 border-slate-700 opacity-75'
      : 'bg-slate-800 border-slate-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
      }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => onToggle(task.id)}
            aria-label="Toggle task completion"
            className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${task.completed
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-600 hover:border-blue-500'
              }`}
          >
            {task.completed && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          </button>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 relative z-10">
              {/* Priority Badge */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'priority' ? null : 'priority')}
                  className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold tracking-tight hover:brightness-110 transition-all ${getPriorityColor(task.priority)}`}
                >
                  {task.priority}
                </button>
                <AnimatePresence>
                  {activeDropdown === 'priority' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)}></div>
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 z-50 bg-[#0f172a] border border-white/10 rounded-lg shadow-2xl p-1 flex flex-col gap-1 min-w-[100px] shadow-black/50 overflow-hidden ring-1 ring-white/5"
                      >
                        {PRIORITIES.map(p => (
                          <button
                            key={p}
                            onClick={() => {
                              onUpdate(task.id, { priority: p });
                              setActiveDropdown(null);
                            }}
                            className={`px-3 py-1.5 text-[10px] uppercase font-bold rounded-md text-left transition-all ${task.priority === p
                              ? 'bg-white/10 text-white'
                              : 'hover:bg-white/5'
                              } ${p === 'high' ? 'text-red-400 hover:text-red-300' :
                                p === 'medium' ? 'text-yellow-400 hover:text-yellow-300' :
                                  'text-green-400 hover:text-green-300'
                              }`}
                          >
                            {p}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Category Badge */}
              <div className="relative">
                <button
                  onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium hover:bg-blue-500/20 transition-all"
                >
                  {task.category}
                </button>
                <AnimatePresence>
                  {activeDropdown === 'category' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)}></div>
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 z-50 bg-[#0f172a] border border-white/10 rounded-lg shadow-2xl p-1 flex flex-col gap-1 min-w-[120px] shadow-black/50 ring-1 ring-white/5"
                      >
                        {CATEGORIES.map(c => (
                          <button
                            key={c}
                            onClick={() => {
                              onUpdate(task.id, { category: c });
                              setActiveDropdown(null);
                            }}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md text-left transition-colors ${task.category === c ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                              }`}
                          >
                            {c}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <h4 className={`font-semibold text-slate-100 ${task.completed ? 'line-through text-slate-500' : ''}`}>
              {task.title}
            </h4>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          </div>
        </div>

        <button
          onClick={() => onDelete(task.id)}
          aria-label="Delete task"
          className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>

      {task.completed && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium uppercase">Performance Rating</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRate(task.id, star)}
                className={`transition-colors ${(task.rating || 0) >= star ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;

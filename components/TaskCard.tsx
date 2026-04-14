import React, { useState } from 'react';
import { Task, Priority } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
  onRate: (id: string, rating: number) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onMerge?: (id: string) => void;
  onToggleRecurring?: (id: string) => void;
  activeDropdown?: 'priority' | 'category' | null;
  onSetActiveDropdown?: (type: 'priority' | 'category' | null) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const CATEGORIES = ['General', 'Work', 'Personal', 'Health', 'Finance', 'Learning'];

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onRate, onDelete, onUpdate, onMerge, onToggleRecurring, isFirst, isLast }) => {
  const [activeDropdown, setActiveDropdown] = useState<'priority' | 'category' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description);
  const [editStartTime, setEditStartTime] = useState(task.startTime || '');
  const [editEndTime, setEditEndTime] = useState(task.endTime || '');

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const handleSaveEdit = () => {
    onUpdate(task.id, { 
      title: editTitle, 
      description: editDesc,
      startTime: editStartTime || undefined,
      endTime: editEndTime || undefined 
    });
    setIsEditing(false);
  };

  return (
    <div className={`group relative p-4 rounded-xl border transition-all duration-300 ${task.completed
      ? 'bg-slate-800/40 border-slate-700 opacity-75'
      : 'bg-slate-800 border-slate-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
      }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 w-full">
          <button
            onClick={() => onToggle(task.id)}
            aria-label="Toggle task completion"
            className={`mt-1 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${task.completed
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-600 hover:border-blue-500'
              }`}
          >
            {task.completed && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 relative z-10 w-full flex-wrap">
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

            {isEditing ? (
              <div className="flex flex-col gap-2 mt-2 z-10 relative">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="bg-slate-900/50 border border-blue-500/30 rounded-lg px-3 py-2 text-sm font-semibold text-white outline-none focus:ring-1 focus:ring-blue-500 w-full"
                  placeholder="Task title"
                />
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="bg-slate-900/50 border border-blue-500/30 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] w-full resize-none"
                  placeholder="Task description"
                />
                <div className="flex justify-between items-center gap-2 mt-1">
                  <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-blue-500/20">
                    <input 
                      type="time" 
                      value={editStartTime} 
                      onChange={e => setEditStartTime(e.target.value)}
                      className="bg-transparent text-xs text-slate-300 outline-none w-20 appearance-none transition-all duration-200 hover:bg-white/10 hover:text-white cursor-pointer px-1 py-0.5 rounded [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                      style={{ colorScheme: 'dark' }}
                    />
                    <span className="text-slate-500 text-xs">-</span>
                    <input 
                      type="time" 
                      value={editEndTime}
                      onChange={e => setEditEndTime(e.target.value)}
                      className="bg-transparent text-xs text-slate-300 outline-none w-20 appearance-none transition-all duration-200 hover:bg-white/10 hover:text-white cursor-pointer px-1 py-0.5 rounded [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => {
                      setIsEditing(false);
                      setEditTitle(task.title);
                      setEditDesc(task.description);
                      setEditStartTime(task.startTime || '');
                      setEditEndTime(task.endTime || '');
                    }} className="px-3 py-1 rounded-md text-[10px] uppercase font-bold text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors">Cancel</button>
                    <button onClick={handleSaveEdit} className="px-3 py-1 rounded-md text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors">Save</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h4 className={`font-semibold text-slate-100 break-words ${task.completed ? 'line-through text-slate-500' : ''}`}>
                  {task.title}
                </h4>
                <p className="text-sm text-slate-400 mt-1 line-clamp-2 break-words">
                  {task.description}
                </p>
              </>
            )}
          </div>
        </div>

        {!isEditing && (
          <div className="flex flex-col items-end gap-2 flex-shrink-0 mt-1">
            <div className="flex flex-row gap-2">
              {onToggleRecurring && (
                <button
                  onClick={() => onToggleRecurring(task.id)}
                  aria-label={task.isRecurring ? "Remove recurring" : "Make recurring"}
                  title={task.isRecurring ? "This task repeats daily \u2014 click to stop" : "Repeat this task every day"}
                  className={`p-1.5 bg-slate-800/80 rounded-lg border transition-all duration-300 ease-out active:scale-90 active:translate-y-[2px] active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] ${
                    task.isRecurring
                      ? 'text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10 opacity-100'
                      : 'text-slate-500 hover:text-emerald-400 border-transparent hover:border-emerald-500/30 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setIsEditing(true)}
                aria-label="Edit task"
                className="p-1.5 text-slate-500 hover:text-blue-400 bg-slate-800/80 rounded-lg border border-transparent hover:border-blue-500/30 transition-all opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
              <button
                onClick={() => onDelete(task.id)}
                aria-label="Delete task"
                className="p-1.5 text-slate-500 hover:text-red-400 bg-slate-800/80 rounded-lg border border-transparent hover:border-red-500/30 transition-all opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>

            {(task.startTime || task.endTime) && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-md text-blue-400 whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                    {task.startTime || '?'} - {task.endTime || '?'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
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

      {/* Hover Merge Button */}
      {onMerge && !task.completed && !isEditing && !isLast && (
        <div className="absolute -bottom-[14px] left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            onClick={() => onMerge(task.id)}
            className="text-slate-500 hover:text-blue-400 bg-slate-800 px-3 py-0.5 rounded-full shadow-lg border border-slate-700 hover:border-blue-500/50 flex items-center gap-1 justify-center transform hover:scale-105 transition-all group/merge"
            title="Merge with next task"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest hidden group-hover/merge:block">Merge</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover/merge:translate-y-[1px] transition-transform"><path d="M8 18L12 22L16 18" /><path d="M12 2V22" /><path d="M8 6L12 2L16 6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskCard;

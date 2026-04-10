import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import { motion, useDragControls } from 'framer-motion';

interface ScheduleBoardProps {
  tasks: Task[];
  selectedDate: string;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

const PIXELS_PER_MINUTE = 2; // 1 hour = 120px
const TOTAL_MINUTES = 24 * 60;
const BOARD_HEIGHT = TOTAL_MINUTES * PIXELS_PER_MINUTE;

const timeToMinutes = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};

const minutesToTime = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const ScheduleBoard: React.FC<ScheduleBoardProps> = ({ tasks, selectedDate, onUpdateTask }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const todayTasks = tasks.filter(t => t.date === selectedDate && t.startTime);
  const unscheduledTasks = tasks.filter(t => t.date === selectedDate && !t.startTime && !t.completed);

  const handleDragEnd = (taskId: string, event: any, info: any, originalStartMins: number, originalEndMins: number) => {
    // Determine new absolute position based on drag offset
    const deltaY = info.offset.y;
    const deltaMins = Math.round(deltaY / PIXELS_PER_MINUTE / 15) * 15; // Snap to 15 mins

    let newStart = originalStartMins + deltaMins;
    let newEnd = originalEndMins + deltaMins;

    // Bounds check
    if (newStart < 0) {
      newEnd -= newStart; // Keep duration
      newStart = 0;
    }
    if (newEnd > TOTAL_MINUTES) {
      newStart -= (newEnd - TOTAL_MINUTES);
      newEnd = TOTAL_MINUTES;
    }

    onUpdateTask(taskId, {
      startTime: minutesToTime(newStart),
      endTime: minutesToTime(newEnd)
    });
  };

  const handleResizeEnd = (taskId: string, event: any, info: any, originalEndMins: number) => {
     // Resize by dragging the bottom handle
     const deltaY = info.offset.y;
     const deltaMins = Math.round(deltaY / PIXELS_PER_MINUTE / 15) * 15;
     
     let newEnd = originalEndMins + deltaMins;
     if (newEnd > TOTAL_MINUTES) newEnd = TOTAL_MINUTES;
     
     // Minimum 15 minutes duration
     const task = todayTasks.find(t => t.id === taskId);
     if (task) {
        const startMins = timeToMinutes(task.startTime);
        if (newEnd <= startMins) newEnd = startMins + 15;
        
        onUpdateTask(taskId, {
          endTime: minutesToTime(newEnd)
        });
     }
  };

  const getPriorityColors = (p: string) => {
    switch(p) {
      case 'high': return 'bg-red-500/20 border-red-500/30 text-red-100 shadow-red-500/10';
      case 'medium': return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-100 shadow-yellow-500/10';
      case 'low': return 'bg-green-500/20 border-green-500/30 text-green-100 shadow-green-500/10';
      default: return 'bg-blue-500/20 border-blue-500/30 text-blue-100 shadow-blue-500/10';
    }
  };

  return (
    <div className="flex gap-6 h-full min-h-[800px]">
      {/* Sidebar: Unscheduled */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-4">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm shadow-xl flex-1 overflow-y-auto">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 sticky top-0 bg-slate-800/90 py-2">Unscheduled</h3>
          <div className="flex flex-col gap-3">
            {unscheduledTasks.length === 0 && (
              <p className="text-xs text-slate-500 italic">All tasks scheduled!</p>
            )}
            {unscheduledTasks.map(task => (
              <div key={task.id} className={`p-3 rounded-lg border text-sm cursor-pointer hover:scale-[1.02] transition-transform ${getPriorityColors(task.priority)}`}>
                <p className="font-semibold">{task.title}</p>
                <div className="mt-2 flex justify-end">
                  <button 
                    onClick={() => onUpdateTask(task.id, { startTime: '09:00', endTime: '10:00' })}
                    className="text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white"
                  >
                    + Add to Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid Environment */}
      <div className="flex-1 bg-slate-900/40 rounded-2xl border border-white/5 p-6 overflow-y-auto custom-scrollbar relative shadow-inset-xl">
        <div 
          ref={containerRef}
          className="relative w-full"
          style={{ height: BOARD_HEIGHT }}
        >
          {/* Background Hour Lines */}
          {Array.from({ length: 25 }).map((_, i) => (
            <div 
              key={i} 
              className="absolute w-full flex items-center border-t border-white/[0.03]"
              style={{ top: i * 60 * PIXELS_PER_MINUTE }}
            >
              <span className="absolute -top-3 -left-12 text-[10px] font-bold text-slate-500 w-10 text-right pr-2">
                {i.toString().padStart(2, '0')}:00
              </span>
            </div>
          ))}

          {/* Time Blocks */}
          {todayTasks.map(task => {
            const startMins = timeToMinutes(task.startTime);
            const endMins = timeToMinutes(task.endTime) || (startMins + 60);
            const durationMins = endMins - startMins;

            const topPx = startMins * PIXELS_PER_MINUTE;
            const heightPx = durationMins * PIXELS_PER_MINUTE;

            return (
              <motion.div
                key={task.id}
                drag="y"
                dragMomentum={false}
                dragConstraints={containerRef}
                onDragEnd={(e, info) => handleDragEnd(task.id, e, info, startMins, endMins)}
                className={`absolute left-0 right-8 rounded-xl border backdrop-blur-md shadow-lg flex flex-col overflow-hidden cursor-grab active:cursor-grabbing group ${getPriorityColors(task.priority)}`}
                style={{ top: topPx, height: heightPx, zIndex: 10 }}
                whileHover={{ scale: 1.01, zIndex: 20 }}
                whileDrag={{ scale: 1.02, zIndex: 50, opacity: 0.9 }}
              >
                <div className="px-4 py-2 flex-1 min-h-0 truncate flex gap-3 items-start pointer-events-none">
                   <div className="w-1.5 h-full bg-white/20 rounded-full flex-shrink-0"></div>
                   <div>
                     <h4 className="font-bold text-sm truncate">{task.title}</h4>
                     <p className="text-[10px] opacity-70 font-mono mt-0.5 tracking-wider">
                       {task.startTime} - {task.endTime}
                     </p>
                   </div>
                </div>
                
                {/* Resizer Handle (Bottom) */}
                <motion.div 
                  className="h-3 w-full cursor-ns-resize absolute bottom-0 left-0 hover:bg-white/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                  drag="y"
                  dragMomentum={false}
                  onDragEnd={(e, info) => handleResizeEnd(task.id, e, info, endMins)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-10 h-1 bg-white/40 rounded-full"></div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.4);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.4);
        }
      `}</style>
    </div>
  );
};

export default ScheduleBoard;

import React, { useRef } from 'react';
import { Task } from '../types';
import { motion } from 'framer-motion';

interface ScheduleBoardProps {
  tasks: Task[];
  selectedDate: string;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

const PIXELS_PER_MINUTE = 3; // 1 hr = 180px
const TOTAL_MINUTES = 24 * 60;
const BOARD_WIDTH = TOTAL_MINUTES * PIXELS_PER_MINUTE;
const ROW_HEIGHT = 160;

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

const getCategoryColors = (c: string) => {
  switch(c) {
    case 'Work': return 'bg-gradient-to-br from-violet-500/80 to-violet-600/80 border-violet-400 text-white shadow-violet-500/20';
    case 'Personal': return 'bg-gradient-to-br from-emerald-500/80 to-emerald-600/80 border-emerald-400 text-white shadow-emerald-500/20';
    case 'Health': return 'bg-gradient-to-br from-amber-500/80 to-amber-600/80 border-amber-400 text-amber-50 shadow-amber-500/20';
    case 'Finance': return 'bg-gradient-to-br from-cyan-500/80 to-cyan-600/80 border-cyan-400 text-white shadow-cyan-500/20';
    case 'Learning': return 'bg-gradient-to-br from-red-500/80 to-red-600/80 border-red-400 text-white shadow-red-500/20';
    default: return 'bg-gradient-to-br from-blue-500/80 to-blue-600/80 border-blue-400 text-white shadow-blue-500/20'; // General
  }
};

const getAdjacentDate = (dateStr: string, daysOffset: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

const ScheduleBoard: React.FC<ScheduleBoardProps> = ({ tasks, selectedDate, onUpdateTask }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const yesterdayDate = getAdjacentDate(selectedDate, -1);
  const tomorrowDate = getAdjacentDate(selectedDate, 1);

  const getFilteredTasks = (date: string) => tasks.filter(t => t.date === date && t.startTime);
  
  const yesterdayTasks = getFilteredTasks(yesterdayDate);
  const todayTasks = getFilteredTasks(selectedDate);
  const tomorrowTasks = getFilteredTasks(tomorrowDate);

  const unscheduledTasks = tasks.filter(t => t.date === selectedDate && !t.startTime && !t.completed);

  const handleDragEnd = (taskId: string, event: any, info: any, originalStartMins: number, originalEndMins: number) => {
    const deltaX = info.offset.x;
    const deltaMins = Math.round(deltaX / PIXELS_PER_MINUTE / 30) * 30; // Snap to 30 mins

    let newStart = originalStartMins + deltaMins;
    let newEnd = originalEndMins + deltaMins;

    if (newStart < 0) {
      newEnd -= newStart; 
      newStart = 0;
    }
    if (newEnd > TOTAL_MINUTES) {
      newStart -= (newEnd - TOTAL_MINUTES);
      newEnd = TOTAL_MINUTES;
    }

    onUpdateTask(taskId, {
      startTime: minutesToTime(newStart),
      endTime: minutesToTime(endMins)
    });
  };

  const handleUnscheduledDragEnd = (taskId: string, event: any, info: any) => {
    const boardRect = scrollRef.current?.getBoundingClientRect();
    if (!boardRect) return;

    // Check if pointer is within the board bounds
    if (info.point.x >= boardRect.left && info.point.x <= boardRect.right &&
        info.point.y >= boardRect.top && info.point.y <= boardRect.bottom) {

      const dropX = info.point.x - boardRect.left + (scrollRef.current?.scrollLeft || 0) - 16;
      const dropMins = Math.max(0, Math.round(dropX / PIXELS_PER_MINUTE / 30) * 30);
      
      let endMins = dropMins + 60; // Default 1 hour
      if (endMins > TOTAL_MINUTES) endMins = TOTAL_MINUTES;
      
      onUpdateTask(taskId, {
        startTime: minutesToTime(dropMins),
        endTime: minutesToTime(endMins)
      });
    }
  };

  const handleResizeEnd = (taskId: string, event: any, info: any, originalEndMins: number, startMins: number) => {
     const deltaX = info.offset.x;
     const deltaMins = Math.round(deltaX / PIXELS_PER_MINUTE / 30) * 30;
     
     let newEnd = originalEndMins + deltaMins;
     if (newEnd > TOTAL_MINUTES) newEnd = TOTAL_MINUTES;
     
     if (newEnd <= startMins) newEnd = startMins + 30; // Minimum 30 min duration
     
     onUpdateTask(taskId, {
       endTime: minutesToTime(newEnd)
     });
  };

  const handleDeleteSchedule = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateTask(taskId, { startTime: undefined, endTime: undefined });
  };

  const renderTrack = (trackName: string, trackTasks: Task[], isActiveDay: boolean) => {
    return (
      <div className={`relative w-full border-b border-white/5 flex group/track ${isActiveDay ? 'opacity-100 bg-slate-900/30' : 'opacity-40 hover:opacity-70 transition-opacity'}`} style={{ height: ROW_HEIGHT }}>
        {/* Row Label */}
        <div className="absolute left-4 top-4 z-20 pointer-events-none fade-in">
          <span className="text-sm font-black uppercase tracking-widest text-slate-500 drop-shadow-md bg-slate-950/50 px-2 py-1 rounded">
            {trackName}
          </span>
        </div>

        {/* Time Blocks */}
        {trackTasks.map(task => {
          const startMins = timeToMinutes(task.startTime);
          const endMins = timeToMinutes(task.endTime) || (startMins + 60);
          const durationMins = endMins - startMins;

          const leftPx = startMins * PIXELS_PER_MINUTE;
          const widthPx = durationMins * PIXELS_PER_MINUTE;

          return (
            <motion.div
              key={task.id}
              drag={isActiveDay ? "x" : false}
              dragMomentum={false}
              dragConstraints={containerRef}
              onDragEnd={(e, info) => handleDragEnd(task.id, e, info, startMins, endMins)}
              className={`absolute top-12 bottom-6 rounded-xl border backdrop-blur-md shadow-lg flex flex-col overflow-hidden group/item ${getCategoryColors(task.category)} ${isActiveDay ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
              style={{ left: leftPx, width: widthPx, zIndex: isActiveDay ? 10 : 5 }}
              whileHover={isActiveDay ? { scale: 1.02, zIndex: 20 } : {}}
              whileDrag={isActiveDay ? { scale: 1.05, zIndex: 50, opacity: 0.9 } : {}}
            >
              <div className="px-4 py-3 flex-1 min-w-0 truncate flex gap-3 items-center pointer-events-none relative h-full">
                 <div className="w-1.5 h-10 bg-white/30 rounded-full flex-shrink-0"></div>
                 <div className="flex-1 min-w-0 truncate pr-6">
                   <h4 className="font-bold text-sm truncate">{task.title}</h4>
                   <p className="text-[10px] opacity-80 font-mono mt-1 tracking-widest">
                     {task.startTime} - {task.endTime}
                   </p>
                 </div>
              </div>
              
              {isActiveDay && (
                <>
                  <button
                    onClick={(e) => handleDeleteSchedule(task.id, e)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-900/40 text-white flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-500/80 transition-all pointer-events-auto shadow-md"
                    title="Remove from schedule"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>

                  <motion.div 
                    className="w-4 h-full cursor-ew-resize absolute top-0 right-0 hover:bg-white/30 transition-colors flex items-center justify-center opacity-0 group-hover/item:opacity-100 border-l border-white/20 pointer-events-auto backdrop-blur-sm"
                    drag="x"
                    dragMomentum={false}
                    onDragEnd={(e, info) => handleResizeEnd(task.id, e, info, endMins, startMins)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-1 h-6 bg-white/60 rounded-full shadow-sm"></div>
                  </motion.div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex gap-6 h-full min-h-[600px] flex-col md:flex-row">
      {/* Sidebar: Unscheduled */}
      <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm shadow-xl flex-1 pb-16">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 sticky top-0 bg-slate-800/90 py-2 z-20">Unscheduled</h3>
          <div className="flex flex-col gap-3 relative z-30">
            {unscheduledTasks.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center p-4 py-8 bg-slate-900/40 rounded-xl border border-dashed border-white/10">All tasks scheduled!</p>
            )}
            {unscheduledTasks.map(task => (
              <motion.div 
                key={task.id} 
                drag
                dragSnapToOrigin
                whileDrag={{ scale: 1.05, opacity: 0.9, zIndex: 100 }}
                onDragEnd={(e, info) => handleUnscheduledDragEnd(task.id, e, info)}
                className={`p-3 rounded-lg border text-sm cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform ${getCategoryColors(task.category)} relative z-10`}
              >
                <p className="font-semibold">{task.title}</p>
                <div className="mt-2 flex justify-between items-center opacity-80 text-[10px] font-bold uppercase tracking-wider">
                  <span>{task.category}</span>
                  <span className="opacity-0 group-hover:opacity-100 italic transition-opacity">Drag me</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid Environment - Horizontal */}
      <div 
        ref={scrollRef}
        className="flex-1 bg-slate-900/40 rounded-2xl border border-white/5 p-4 overflow-x-auto overflow-y-hidden custom-scrollbar relative shadow-inset-xl"
      >
        <div 
          ref={containerRef}
          className="relative h-full flex flex-col"
          style={{ width: BOARD_WIDTH, minHeight: ROW_HEIGHT * 3 + 40 }}
        >
          {/* Background Hour Grid */}
          <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
            {Array.from({ length: 49 }).map((_, i) => (
              <div 
                key={i} 
                className={`absolute top-0 bottom-0 flex flex-col ${i % 2 === 0 ? 'border-l border-white/[0.05]' : 'border-l border-white/[0.02] border-dashed'}`}
                style={{ left: i * 30 * PIXELS_PER_MINUTE }}
              >
                {i % 2 === 0 && (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-900/40 px-1 rounded-bl sticky top-0 shadow-sm ml-1">
                    {(i / 2).toString().padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Render Tracks */}
          <div className="relative z-10 pt-6 space-y-2">
            {renderTrack("Yesterday", yesterdayTasks, false)}
            {renderTrack("Today", todayTasks, true)}
            {renderTrack("Tomorrow", tomorrowTasks, false)}
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.4); border-radius: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.4); }
      `}</style>
    </div>
  );
};

export default ScheduleBoard;

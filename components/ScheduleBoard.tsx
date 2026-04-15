import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Task } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface ScheduleBoardProps {
  tasks: Task[];
  selectedDate: string;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const PPM = 3;           // pixels per minute
const TOTAL_MINS = 1440; // 24 × 60
const BOARD_WIDTH = TOTAL_MINS * PPM;
const ROW_HEIGHT = 160;
const SNAP_MINS = 15;    // snap to 15-min grid (finer than 30)
const POP_THRESHOLD = 80; // px above/below row before task pops out to unscheduled
const SCROLL_ZONE = 90;   // px from board edge to start auto-scroll

// ── Helpers ──────────────────────────────────────────────────────────────────
const toMins = (t?: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};
const toTime = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const snap = (m: number) => Math.round(m / SNAP_MINS) * SNAP_MINS;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const getAdjacentDate = (dateStr: string, d: number) => {
  const dt = new Date(dateStr);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split('T')[0];
};

// ── Category colors — matched exactly to user spec from the Insights chart ──
// Learning=purple, Work=orange, Personal=blue, Health=green, Finance=teal, General=red
const CAT: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  Learning: { bg: 'from-violet-500/90 to-violet-700/90', border: 'border-violet-400/70', text: 'text-white',    shadow: 'shadow-violet-500/25' },
  Work:     { bg: 'from-amber-500/90 to-amber-700/90',   border: 'border-amber-400/70',  text: 'text-amber-50', shadow: 'shadow-amber-500/25'  },
  Personal: { bg: 'from-blue-500/90 to-blue-700/90',     border: 'border-blue-400/70',   text: 'text-white',    shadow: 'shadow-blue-500/25'   },
  Health:   { bg: 'from-emerald-500/90 to-emerald-700/90', border: 'border-emerald-400/70', text: 'text-white', shadow: 'shadow-emerald-500/25' },
  Finance:  { bg: 'from-cyan-500/90 to-cyan-700/90',     border: 'border-cyan-400/70',   text: 'text-white',    shadow: 'shadow-cyan-500/25'   },
  General:  { bg: 'from-red-500/90 to-red-700/90',       border: 'border-red-400/70',    text: 'text-white',    shadow: 'shadow-red-500/25'    },
};
const getS = (cat: string) => CAT[cat] || CAT['General'];

// ── TaskBlock ────────────────────────────────────────────────────────────────
interface TaskBlockProps {
  task: Task;
  isActiveDay: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  trackRef:  React.RefObject<HTMLDivElement>;
  onCommitMove:        (id: string, start: number, end: number) => void;
  onCommitResizeLeft:  (id: string, start: number) => void;
  onCommitResizeRight: (id: string, end: number)   => void;
  onUnschedule:        (id: string) => void;
  setAnyDragging:      (v: boolean) => void;
}

const TaskBlock: React.FC<TaskBlockProps> = ({
  task, isActiveDay, scrollRef, trackRef,
  onCommitMove, onCommitResizeLeft, onCommitResizeRight, onUnschedule, setAnyDragging,
}) => {
  const startM = toMins(task.startTime);
  const endM   = toMins(task.endTime) || startM + 60;
  const dur    = Math.max(SNAP_MINS, endM - startM);

  const [vLeft,    setVLeft]    = useState(startM * PPM);
  const [vWidth,   setVWidth]   = useState(dur * PPM);
  const [liveLabel, setLiveLabel] = useState(`${task.startTime ?? ''} – ${task.endTime ?? ''}`);
  const [isDragging, setIsDragging] = useState(false);
  const [poppingOut, setPoppingOut] = useState(false);

  // Sync when external task data changes
  useEffect(() => {
    setVLeft(startM * PPM);
    setVWidth(dur * PPM);
    setLiveLabel(`${task.startTime ?? ''} – ${task.endTime ?? ''}`);
  }, [startM, endM, dur, task.startTime, task.endTime]);

  const raf    = useRef<number>(0);
  const scrollRaf = useRef<number>(0);

  const stopScroll = () => cancelAnimationFrame(scrollRaf.current);
  const doAutoScroll = useCallback((clientX: number) => {
    stopScroll();
    if (!scrollRef.current) return;
    const br = scrollRef.current.getBoundingClientRect();
    const right = br.right - clientX;
    const left  = clientX - br.left;
    let speed = 0, dir = 0;
    if (right > 0 && right < SCROLL_ZONE)  { dir =  1; speed = Math.ceil((SCROLL_ZONE - right) / 6); }
    if (left  > 0 && left  < SCROLL_ZONE)  { dir = -1; speed = Math.ceil((SCROLL_ZONE - left)  / 6); }
    if (!speed) return;
    const step = () => {
      if (scrollRef.current) scrollRef.current.scrollLeft += dir * speed;
      scrollRaf.current = requestAnimationFrame(step);
    };
    scrollRaf.current = requestAnimationFrame(step);
  }, [scrollRef]);

  const beginDrag = useCallback((
    e: React.MouseEvent,
    type: 'move' | 'resize-left' | 'resize-right',
  ) => {
    if (!isActiveDay) return;
    e.preventDefault();
    e.stopPropagation();

    const origStart = startM;
    const origEnd   = endM;
    const startX    = e.clientX;

    setIsDragging(true);
    setAnyDragging(true);

    const onMm = (ev: MouseEvent) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const scrollOff = scrollRef.current?.scrollLeft ?? 0;
        const dx     = ev.clientX - startX;
        const dMins  = snap(dx / PPM);

        // Y pop-out check (only for move)
        if (type === 'move' && trackRef.current) {
          const r = trackRef.current.getBoundingClientRect();
          setPoppingOut(ev.clientY < r.top - POP_THRESHOLD || ev.clientY > r.bottom + POP_THRESHOLD);
        }

        doAutoScroll(ev.clientX);

        if (type === 'move') {
          let ns = clamp(origStart + dMins, 0, TOTAL_MINS - (origEnd - origStart));
          let ne = ns + (origEnd - origStart);
          setVLeft(ns * PPM);
          setLiveLabel(`${toTime(snap(ns))} – ${toTime(snap(ne))}`);
        } else if (type === 'resize-right') {
          const ne = clamp(origEnd + dMins, origStart + SNAP_MINS, TOTAL_MINS);
          setVWidth(Math.max(SNAP_MINS * PPM, (ne - origStart) * PPM));
          setLiveLabel(`${toTime(origStart)} – ${toTime(snap(ne))}`);
        } else { // resize-left
          const ns = clamp(origStart + dMins, 0, origEnd - SNAP_MINS);
          setVLeft(ns * PPM);
          setVWidth(Math.max(SNAP_MINS * PPM, (origEnd - ns) * PPM));
          setLiveLabel(`${toTime(snap(ns))} – ${toTime(origEnd)}`);
        }
      });
    };

    const onMu = (ev: MouseEvent) => {
      cancelAnimationFrame(raf.current);
      stopScroll();
      window.removeEventListener('mousemove', onMm);
      window.removeEventListener('mouseup', onMu);
      setIsDragging(false);
      setAnyDragging(false);
      setPoppingOut(false);

      const dx    = ev.clientX - startX;
      const dMins = snap(dx / PPM);

      // Check trash zone first
      const trashEl = document.getElementById('sched-trash');
      if (trashEl) {
        const r = trashEl.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          onUnschedule(task.id);
          return;
        }
      }

      // Check Y pop-out
      if (type === 'move' && trackRef.current) {
        const r = trackRef.current.getBoundingClientRect();
        if (ev.clientY < r.top - POP_THRESHOLD || ev.clientY > r.bottom + POP_THRESHOLD) {
          onUnschedule(task.id);
          return;
        }
      }

      if (type === 'move') {
        const ns = clamp(origStart + dMins, 0, TOTAL_MINS - (origEnd - origStart));
        onCommitMove(task.id, snap(ns), snap(ns + (origEnd - origStart)));
      } else if (type === 'resize-right') {
        onCommitResizeRight(task.id, snap(clamp(origEnd + dMins, origStart + SNAP_MINS, TOTAL_MINS)));
      } else {
        onCommitResizeLeft(task.id, snap(clamp(origStart + dMins, 0, origEnd - SNAP_MINS)));
      }
    };

    window.addEventListener('mousemove', onMm);
    window.addEventListener('mouseup', onMu);
  }, [isActiveDay, startM, endM, task.id, scrollRef, trackRef, doAutoScroll,
      onCommitMove, onCommitResizeLeft, onCommitResizeRight, onUnschedule, setAnyDragging]);

  const s = getS(task.category);

  return (
    <div
      onMouseDown={(e) => beginDrag(e, 'move')}
      className={`absolute top-10 bottom-4 rounded-xl border-2 backdrop-blur-sm shadow-xl flex items-stretch overflow-visible group/tb select-none bg-gradient-to-br ${s.bg} ${s.border} ${s.text} ${s.shadow} ${
        poppingOut ? 'opacity-30 scale-90' : isDragging ? 'shadow-2xl shadow-black/50 z-50 scale-[1.02]' : 'z-10 hover:z-20 hover:scale-[1.01]'
      }`}
      style={{
        left:  vLeft,
        width: Math.max(SNAP_MINS * PPM, vWidth),
        cursor: isActiveDay ? (isDragging ? 'grabbing' : 'grab') : 'default',
        transition: isDragging ? 'opacity 0.1s, transform 0.1s' : 'box-shadow 0.2s, transform 0.15s, opacity 0.15s',
        willChange: 'left, width',
      }}
    >
      {/* Left resize grip */}
      {isActiveDay && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, 'resize-left'); }}
          className="w-3 flex-shrink-0 cursor-ew-resize flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/tb:opacity-100 transition-opacity hover:bg-white/15 rounded-l-xl border-r border-white/15 pointer-events-auto"
        >
          <div className="w-0.5 h-5 bg-white/50 rounded-full" />
          <div className="w-0.5 h-3 bg-white/30 rounded-full" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 flex gap-1.5 items-center px-2 py-2 pointer-events-none overflow-hidden">
        <div className="w-1 h-7 bg-white/30 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="font-bold text-xs truncate leading-tight">{task.title}</p>
          <p className="text-[10px] opacity-70 font-mono tracking-wide mt-0.5 tabular-nums">{liveLabel}</p>
        </div>
      </div>

      {/* Pop-out overlay */}
      {poppingOut && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl pointer-events-none backdrop-blur-[1px]">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/80">Release to unschedule</span>
        </div>
      )}

      {/* Right resize grip */}
      {isActiveDay && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, 'resize-right'); }}
          className="w-3 flex-shrink-0 cursor-ew-resize flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/tb:opacity-100 transition-opacity hover:bg-white/15 rounded-r-xl border-l border-white/15 pointer-events-auto"
        >
          <div className="w-0.5 h-3 bg-white/30 rounded-full" />
          <div className="w-0.5 h-5 bg-white/50 rounded-full" />
        </div>
      )}
    </div>
  );
};

// ── Track (one horizontal row) ───────────────────────────────────────────────
interface TrackProps {
  name: string;
  trackTasks: Task[];
  isActiveDay: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onCommitMove:        (id: string, s: number, e: number) => void;
  onCommitResizeLeft:  (id: string, s: number) => void;
  onCommitResizeRight: (id: string, e: number) => void;
  onUnschedule:        (id: string) => void;
  setAnyDragging:      (v: boolean) => void;
}

const Track: React.FC<TrackProps> = (props) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const { name, trackTasks, isActiveDay, scrollRef, ...handlers } = props;
  return (
    <div
      ref={trackRef}
      className={`relative w-full border-b border-white/5 ${isActiveDay ? 'bg-slate-900/30' : 'opacity-40 hover:opacity-55 transition-opacity'}`}
      style={{ height: ROW_HEIGHT }}
    >
      <div className="absolute left-3 top-2 z-20 pointer-events-none">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-950/60 px-1.5 py-0.5 rounded">{name}</span>
      </div>
      {trackTasks.map(task => (
        <TaskBlock
          key={task.id}
          task={task}
          isActiveDay={isActiveDay}
          scrollRef={scrollRef}
          trackRef={trackRef}
          {...handlers}
        />
      ))}
    </div>
  );
};

// ── ScheduleBoard ────────────────────────────────────────────────────────────
const ScheduleBoard: React.FC<ScheduleBoardProps> = ({ tasks, selectedDate, onUpdateTask }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [anyDragging,  setAnyDragging]  = useState(false);
  const [isOverTrash,  setIsOverTrash]  = useState(false);
  const [sidebarDragId, setSidebarDragId] = useState<string | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);

  const yd = getAdjacentDate(selectedDate, -1);
  const td = getAdjacentDate(selectedDate,  1);

  const scheduled   = (date: string) => tasks.filter(t => t.date === date && !!t.startTime);
  const unscheduled = tasks.filter(t => t.date === selectedDate && !t.startTime && !t.completed);

  const handleMove        = useCallback((id: string, s: number, e: number) => onUpdateTask(id, { startTime: toTime(s), endTime: toTime(e) }), [onUpdateTask]);
  const handleResizeLeft  = useCallback((id: string, s: number) => onUpdateTask(id, { startTime: toTime(s) }), [onUpdateTask]);
  const handleResizeRight = useCallback((id: string, e: number) => onUpdateTask(id, { endTime:   toTime(e) }), [onUpdateTask]);
  const handleUnschedule  = useCallback((id: string) => onUpdateTask(id, { startTime: undefined, endTime: undefined }), [onUpdateTask]);

  // ── Sidebar card drag ────────────────────────────────────────────────────
  const startSidebarDrag = useCallback((e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setSidebarDragId(taskId);
    setAnyDragging(true);

    const task = tasks.find(t => t.id === taskId);
    const s    = getS(task?.category ?? 'General');

    // Build ghost element
    const ghost = document.createElement('div');
    ghost.style.cssText = [
      'position:fixed;z-index:9999;pointer-events:none;',
      'padding:8px 12px;border-radius:10px;border-width:2px;border-style:solid;',
      'font-size:12px;font-weight:800;',
      'backdrop-filter:blur(12px);',
      'box-shadow:0 20px 48px rgba(0,0,0,0.6);',
      'transform:scale(1.06) rotate(-1.5deg);',
      'transition:transform 0.1s;',
      `left:${e.clientX - 88}px;top:${e.clientY - 24}px;`,
      'max-width:176px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      'color:white;',
    ].join('');
    ghost.className = `bg-gradient-to-br ${s.bg} ${s.border}`;
    ghost.innerHTML = `<div style="truncate">${task?.title ?? ''}</div><div style="font-size:10px;opacity:0.65;margin-top:2px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">${task?.category ?? ''}</div>`;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;

    const onMm = (ev: MouseEvent) => {
      if (ghostRef.current) {
        ghostRef.current.style.left = `${ev.clientX - 88}px`;
        ghostRef.current.style.top  = `${ev.clientY - 24}px`;
      }
      // Trash hover
      const trashEl = document.getElementById('sched-trash');
      if (trashEl) {
        const r = trashEl.getBoundingClientRect();
        setIsOverTrash(ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom);
      }
      // Auto-scroll
      if (scrollRef.current) {
        const br = scrollRef.current.getBoundingClientRect();
        const rightD = br.right - ev.clientX;
        const leftD  = ev.clientX - br.left;
        if (rightD > 0 && rightD < SCROLL_ZONE) scrollRef.current.scrollLeft += Math.ceil((SCROLL_ZONE - rightD) / 5);
        if (leftD  > 0 && leftD  < SCROLL_ZONE) scrollRef.current.scrollLeft -= Math.ceil((SCROLL_ZONE - leftD)  / 5);
      }
    };

    const onMu = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMm);
      window.removeEventListener('mouseup', onMu);
      if (ghostRef.current) { document.body.removeChild(ghostRef.current); ghostRef.current = null; }
      setSidebarDragId(null);
      setAnyDragging(false);
      setIsOverTrash(false);

      if (scrollRef.current) {
        const br = scrollRef.current.getBoundingClientRect();
        if (ev.clientX >= br.left && ev.clientX <= br.right &&
            ev.clientY >= br.top  && ev.clientY <= br.bottom) {
          const dropX = ev.clientX - br.left + scrollRef.current.scrollLeft - 16;
          const dropM = snap(Math.max(0, dropX / PPM));
          onUpdateTask(taskId, {
            startTime: toTime(dropM),
            endTime:   toTime(Math.min(TOTAL_MINS, dropM + 60)),
          });
        }
      }
    };

    window.addEventListener('mousemove', onMm);
    window.addEventListener('mouseup', onMu);
  }, [tasks, onUpdateTask]);

  const commonTrackProps = {
    scrollRef,
    onCommitMove: handleMove,
    onCommitResizeLeft: handleResizeLeft,
    onCommitResizeRight: handleResizeRight,
    onUnschedule: handleUnschedule,
    setAnyDragging,
  };

  return (
    <div className="flex gap-5 h-full min-h-[600px] flex-col md:flex-row select-none">

      {/* Sidebar */}
      <div className="w-full md:w-56 flex-shrink-0">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm shadow-xl h-full overflow-y-auto">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 pb-2 border-b border-white/5 sticky top-0 bg-slate-800/90 backdrop-blur-sm">
            Unscheduled
          </h3>
          <div className="flex flex-col gap-2.5">
            {unscheduled.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-white/10">All tasks scheduled!</p>
            )}
            {unscheduled.map(task => {
              const s = getS(task.category);
              return (
                <div
                  key={task.id}
                  onMouseDown={(e) => startSidebarDrag(e, task.id)}
                  className={`p-3 rounded-xl border-2 cursor-grab bg-gradient-to-br ${s.bg} ${s.border} ${s.text} transition-all duration-150 shadow-md ${
                    sidebarDragId === task.id ? 'opacity-30 scale-95' : 'hover:scale-[1.02] hover:shadow-lg'
                  }`}
                >
                  <p className="font-bold text-sm truncate">{task.title}</p>
                  <p className="text-[10px] opacity-65 mt-0.5 font-semibold uppercase tracking-wide">{task.category}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: board + trash */}
      <div className="flex-1 flex flex-col gap-2.5 min-w-0">
        {/* Scrollable board */}
        <div
          ref={scrollRef}
          className="flex-1 bg-slate-900/40 rounded-2xl border border-white/5 p-4 overflow-x-auto overflow-y-hidden custom-scrollbar"
          style={{ userSelect: 'none' }}
        >
          <div className="relative flex flex-col" style={{ width: BOARD_WIDTH, minHeight: ROW_HEIGHT * 3 + 48 }}>

            {/* Hour grid */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 49 }).map((_, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 ${i % 2 === 0 ? 'border-l border-white/[0.06]' : 'border-l border-white/[0.025] border-dashed'}`}
                  style={{ left: i * 30 * PPM }}
                >
                  {i % 2 === 0 && (
                    <span className="text-[9px] font-semibold text-slate-600 bg-slate-900/50 px-1 pt-0.5 block leading-tight">
                      {String(i / 2).padStart(2, '0')}:00
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Tracks */}
            <div className="relative z-10 pt-5 space-y-0.5">
              <Track name="Yesterday" trackTasks={scheduled(yd)}            isActiveDay={false} {...commonTrackProps} />
              <Track name="Today"     trackTasks={scheduled(selectedDate)}  isActiveDay={true}  {...commonTrackProps} />
              <Track name="Tomorrow"  trackTasks={scheduled(td)}            isActiveDay={false} {...commonTrackProps} />
            </div>

          </div>
        </div>

        {/* Trash drop zone */}
        <AnimatePresence>
          {anyDragging && (
            <motion.div
              id="sched-trash"
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: isOverTrash ? 64 : 48 }}
              exit={{ opacity: 0, y: 8, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`flex-shrink-0 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-all duration-200 overflow-hidden ${
                isOverTrash
                  ? 'border-red-500/60 bg-red-500/10 shadow-lg shadow-red-900/20'
                  : 'border-slate-600/30 bg-slate-800/20'
              }`}
            >
              {/* Trash icon changes on hover */}
              <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ width: isOverTrash ? 24 : 18, height: isOverTrash ? 24 : 18 }}
                transition={{ duration: 0.15 }}
                className={`transition-colors duration-200 ${isOverTrash ? 'text-red-400' : 'text-slate-500'}`}
              >
                {isOverTrash ? (
                  // Open lid
                  <>
                    <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                    <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
                    <path d="M2 5l3 1" /><path d="M22 5l-3 1" />
                  </>
                ) : (
                  // Closed lid
                  <>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                    <path d="M10 11v6M14 11v6" />
                  </>
                )}
              </motion.svg>
              <span className={`text-xs font-bold uppercase tracking-widest transition-colors duration-200 ${isOverTrash ? 'text-red-400' : 'text-slate-500'}`}>
                {isOverTrash ? 'Release to unschedule' : 'Drag here to unschedule'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 7px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15,23,42,0.4); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.2); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.45); }
      `}</style>
    </div>
  );
};

export default ScheduleBoard;

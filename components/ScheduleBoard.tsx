import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Task } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface ScheduleBoardProps {
  tasks: Task[];
  selectedDate: string;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const PPM = 3;
const TOTAL_MINS = 1440;
const BOARD_WIDTH = TOTAL_MINS * PPM;
const ROW_HEIGHT = 110;  // Slimmer rows
const SNAP_MINS = 15;
const SCROLL_ZONE = 90;

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
  Learning: { bg: 'bg-violet-600', border: 'border-violet-400', text: 'text-white', shadow: 'shadow-md shadow-black/20' },
  Work: { bg: 'bg-amber-600', border: 'border-amber-400', text: 'text-amber-50', shadow: 'shadow-md shadow-black/20' },
  Personal: { bg: 'bg-blue-600', border: 'border-blue-400', text: 'text-white', shadow: 'shadow-md shadow-black/20' },
  Health: { bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-white', shadow: 'shadow-md shadow-black/20' },
  Finance: { bg: 'bg-cyan-600', border: 'border-cyan-400', text: 'text-white', shadow: 'shadow-md shadow-black/20' },
  General: { bg: 'bg-red-600', border: 'border-red-400', text: 'text-white', shadow: 'shadow-md shadow-black/20' },
  Travel: { bg: 'bg-pink-600', border: 'border-pink-400', text: 'text-white', shadow: 'shadow-md shadow-black/20' },
};
const getS = (cat: string) => CAT[cat] || CAT['General'];

// ── TaskBlock ────────────────────────────────────────────────────────────────
interface TaskBlockProps {
  task: Task;
  isActiveDay: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  trackRef: React.RefObject<HTMLDivElement>;
  onCommitMove: (id: string, start: number, end: number) => void;
  onCommitResizeLeft: (id: string, start: number) => void;
  onCommitResizeRight: (id: string, end: number) => void;
  onUnschedule: (id: string) => void;
  setAnyDragging: (v: boolean) => void;
  setIsOverTrash: (v: boolean) => void;
}

const TaskBlock: React.FC<TaskBlockProps> = ({
  task, isActiveDay, scrollRef, trackRef,
  onCommitMove, onCommitResizeLeft, onCommitResizeRight, onUnschedule, setAnyDragging, setIsOverTrash,
}) => {
  const startM = toMins(task.startTime);
  const endM = toMins(task.endTime) || startM + 60;
  const dur = Math.max(SNAP_MINS, endM - startM);

  const [vLeft, setVLeft] = useState(startM * PPM);
  const [vWidth, setVWidth] = useState(dur * PPM);
  const [liveLabel, setLiveLabel] = useState(`${task.startTime ?? ''} – ${task.endTime ?? ''}`);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const [isTaskOverTrash, setIsTaskOverTrash] = useState(false);
  const ghostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setVLeft(startM * PPM);
    setVWidth(dur * PPM);
    setLiveLabel(`${task.startTime ?? ''} – ${task.endTime ?? ''}`);
  }, [startM, endM, dur, task.startTime, task.endTime]);

  const raf = useRef<number>(0);
  const scrollRaf = useRef<number>(0);

  const stopScroll = () => cancelAnimationFrame(scrollRaf.current);
  const doAutoScroll = useCallback((clientX: number) => {
    stopScroll();
    if (!scrollRef.current) return;
    const br = scrollRef.current.getBoundingClientRect();
    const right = br.right - clientX;
    const left = clientX - br.left;
    let speed = 0, dir = 0;
    if (right > 0 && right < SCROLL_ZONE) { dir = 1; speed = Math.ceil((SCROLL_ZONE - right) / 6); }
    if (left > 0 && left < SCROLL_ZONE) { dir = -1; speed = Math.ceil((SCROLL_ZONE - left) / 6); }
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
    const origEnd = endM;
    const startX = e.clientX;

    setIsDragging(true);
    setDragType(type);
    setAnyDragging(true);

    const onMm = (ev: MouseEvent) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const dx = ev.clientX - startX;
        const dMins = snap(dx / PPM);

        doAutoScroll(ev.clientX);

        if (type === 'move') {
          const trashEl = document.getElementById('sched-trash');
          let over = false;
          if (trashEl) {
            const r = trashEl.getBoundingClientRect();
            over = (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom);
          }

          const s = getS(task.category);
          if (!ghostRef.current) {
            const ghost = document.createElement('div');
            ghost.style.cssText = [
              'position:fixed;z-index:9999;pointer-events:none;',
              'font-size:12px;font-weight:800;color:white;',
              'backdrop-filter:blur(12px);',
              'box-shadow:0 20px 48px rgba(0,0,0,0.6);',
              'transform:scale(1.06);transition:background-color 0.1s, border-color 0.1s;',
              'max-width:176px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
              `left:${ev.clientX - 88}px;top:${ev.clientY - 24}px;`
            ].join('');
            ghost.className = over 
              ? 'text-white bg-red-600 border-red-400 shadow-red-900/40 p-2 rounded-xl border-2' 
              : `text-white bg-gradient-to-br ${s.bg} ${s.border} p-2 rounded-xl border-2`;
            ghost.innerHTML = `<div style="truncate">${task.title}</div><div style="font-size:10px;opacity:0.65;margin-top:2px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">${task.category}</div>`;
            document.body.appendChild(ghost);
            ghostRef.current = ghost;
          } else {
            ghostRef.current.style.left = `${ev.clientX - 88}px`;
            ghostRef.current.style.top = `${ev.clientY - 24}px`;
            ghostRef.current.className = over 
              ? 'text-white bg-red-600 border-red-400 shadow-red-900/40 p-2 rounded-xl border-2' 
              : `text-white bg-gradient-to-br ${s.bg} ${s.border} p-2 rounded-xl border-2`;
          }

          setIsTaskOverTrash(over);
          setIsOverTrash(over);

          let ns = clamp(origStart + dMins, 0, TOTAL_MINS - (origEnd - origStart));
          let ne = ns + (origEnd - origStart);
          setVLeft(ns * PPM);
          setLiveLabel(`${toTime(snap(ns))} – ${toTime(snap(ne))}`);
        } else if (type === 'resize-right') {
          const ne = clamp(origEnd + dMins, origStart + SNAP_MINS, TOTAL_MINS);
          setVWidth(Math.max(SNAP_MINS * PPM, (ne - origStart) * PPM));
          setLiveLabel(`${toTime(origStart)} – ${toTime(snap(ne))}`);
        } else {
          const ns = clamp(origStart + dMins, 0, origEnd - SNAP_MINS);
          setVLeft(ns * PPM);
          setVWidth(Math.max(SNAP_MINS * PPM, (origEnd - ns) * PPM));
          setLiveLabel(`${toTime(snap(ns))} – ${toTime(origEnd)}`);
        }
      });
    };

    const onMu = (ev: MouseEvent) => {
      cancelAnimationFrame(raf.current);
      if (ghostRef.current) {
        document.body.removeChild(ghostRef.current);
        ghostRef.current = null;
      }
      stopScroll();
      window.removeEventListener('mousemove', onMm);
      window.removeEventListener('mouseup', onMu);
      setIsDragging(false);
      setDragType(null);
      setAnyDragging(false);
      setIsTaskOverTrash(false);
      setIsOverTrash(false);

      const dx = ev.clientX - startX;
      const dMins = snap(dx / PPM);

      // Check trash zone — ONLY way to unschedule a placed task
      const trashEl = document.getElementById('sched-trash');
      if (trashEl) {
        const r = trashEl.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
          onUnschedule(task.id);
          return;
        }
      }

      // Check board bounds for valid drop
      let droppedInsideBoard = true;
      if (scrollRef.current && type === 'move') {
        const br = scrollRef.current.getBoundingClientRect();
        // Give a little leeway so dropping near the edge still counts
        if (ev.clientX < br.left - 20 || ev.clientX > br.right + 20 || ev.clientY < br.top - 20 || ev.clientY > br.bottom + 20) {
          droppedInsideBoard = false;
        }
      }

      if (type === 'move') {
        if (!droppedInsideBoard && !isTaskOverTrash) {
          // Snap back if dropped outside the board (and not in trash)
          setVLeft(origStart * PPM);
          setLiveLabel(`${toTime(origStart)} – ${toTime(origEnd)}`);
          return;
        }
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
  const isCompleted = task.completed;
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (isCompleted) {
      const key = `lumina_anim_${task.id}`;
      if (!sessionStorage.getItem(key)) {
        setJustCompleted(true);
        sessionStorage.setItem(key, '1');
        // The fill animation is ~1s, then we hold it for a bit before dropping into pulse
        const t = setTimeout(() => setJustCompleted(false), 2500);
        return () => clearTimeout(t);
      }
    } else {
      sessionStorage.removeItem(`lumina_anim_${task.id}`);
      setJustCompleted(false);
    }
  }, [isCompleted, task.id]);

  return (
    <div
      onMouseDown={(e) => task.id !== 'ghost-preview' ? beginDrag(e, 'move') : undefined}
      className={`absolute top-8 bottom-3 rounded-xl border-2 flex items-stretch overflow-hidden group/tb select-none transition-all duration-150 ${isDragging && dragType === 'move'
          ? `opacity-30 border-dashed pointer-events-none z-auto ${s.bg} ${s.border} ${s.text}`
          : task.id === 'ghost-preview'
            ? `opacity-60 pointer-events-none z-0 ${s.bg} ${s.border} ${s.text}`
            : `${s.bg} ${s.border} ${s.text} ${s.shadow} ${isDragging ? 'shadow-xl shadow-black/40 z-50 scale-[1.02] ring-1 ring-white/10' : 'z-10 hover:z-20 hover:scale-[1.01]'}`
        } ${isCompleted && !justCompleted ? 'border-emerald-500/50 shadow-emerald-900/30 bg-emerald-500 text-white' : ''} ${justCompleted ? 'border-emerald-400 overflow-hidden shadow-emerald-500/40 shadow-xl z-30' : ''}`}
      style={{
        left: vLeft,
        width: Math.max(SNAP_MINS * PPM, vWidth),
        cursor: isActiveDay ? (isDragging ? 'grabbing' : 'grab') : 'default',
        transition: isDragging ? 'opacity 0.1s, transform 0.1s' : 'transform 0.15s, opacity 0.15s',
        willChange: 'left, width',
      }}
    >
      {/* Left resize grip */}
      {isActiveDay && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, 'resize-left'); }}
          className="w-3 flex-shrink-0 cursor-ew-resize flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/tb:opacity-100 transition-opacity hover:bg-white/15 rounded-l-xl border-r border-white/15 pointer-events-auto relative z-10"
        >
          <div className="w-0.5 h-5 bg-white/50 rounded-full" />
          <div className="w-0.5 h-3 bg-white/30 rounded-full" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 flex gap-1.5 items-center px-2 py-1.5 pointer-events-none overflow-hidden relative z-10">
        <div className="w-1 h-5 bg-white/30 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <p className={`font-bold text-xs truncate leading-tight transition-opacity duration-300 ${justCompleted ? 'opacity-0' : 'opacity-100'}`}>{task.title}</p>
          <p className={`text-[10px] opacity-70 font-mono tracking-wide mt-0.5 tabular-nums transition-opacity duration-300 ${justCompleted ? 'opacity-0' : 'opacity-100'}`}>{liveLabel}</p>
        </div>
      </div>

      {/* Completion Animations Overlays */}
      {isCompleted && (
        <>
          {justCompleted ? (
            <>
              {/* Fill background */}
              <div className="absolute inset-0 bg-emerald-500 z-20 origin-left animate-task-fill" />
              {/* Done text */}
              <div className="absolute inset-0 flex items-center justify-center z-30 opacity-0 animate-task-done-text">
                <span className="font-black text-sm tracking-widest text-white drop-shadow-md">DONE !</span>
              </div>
            </>
          ) : (
            <>
              {/* Pulse Ring Overlay */}
              <div className="absolute inset-0 rounded-xl task-pulse pointer-events-none" />
              {/* Solid Background with Shimmering White Gradient */}
              <div className="absolute inset-0 bg-emerald-500 z-0 animate-in fade-in duration-500" />
              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl animate-in fade-in duration-1000 delay-150">
                <div className="absolute top-0 bottom-0 left-0 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </>
          )}
        </>
      )}

      {/* Right resize grip */}
      {isActiveDay && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); beginDrag(e, 'resize-right'); }}
          className="w-3 flex-shrink-0 cursor-ew-resize flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/tb:opacity-100 transition-opacity hover:bg-white/15 rounded-r-xl border-l border-white/15 pointer-events-auto relative z-10"
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
  date: string;
  trackTasks: Task[];
  isActiveDay: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onCommitMove: (id: string, s: number, e: number) => void;
  onCommitResizeLeft: (id: string, s: number) => void;
  onCommitResizeRight: (id: string, e: number) => void;
  onUnschedule: (id: string) => void;
  setAnyDragging: (v: boolean) => void;
  setIsOverTrash: (v: boolean) => void;
}

const Track: React.FC<TrackProps> = (props) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const { name, trackTasks, isActiveDay, scrollRef, date, ...handlers } = props;
  return (
    <div
      id={`track-${date}`}
      ref={trackRef}
      className={`relative w-full border-b border-white/5 flex flex-1 min-h-[80px] ${isActiveDay ? 'bg-slate-900/30' : 'opacity-40 hover:opacity-55 transition-opacity'}`}
    >
      <div className="sticky left-3 top-2 z-20 pointer-events-none h-0 w-max overflow-visible">
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
const ScheduleBoard: React.FC<ScheduleBoardProps> = ({ tasks: rawTasks, selectedDate, onUpdateTask }) => {
  const validCategories = ['Health', 'Personal', 'General', 'Work', 'Travel', 'Finance', 'Learning'];
  const tasks = rawTasks.map(t => ({...t, category: validCategories.includes(t.category) ? t.category : 'General'}));
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [anyDragging, setAnyDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [sidebarDragId, setSidebarDragId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<{ date: string, mins: number } | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const ghostRef = useRef<HTMLElement | null>(null);

  const daysInfo = Array.from({ length: 5 }).map((_, i) => {
    const d = dayOffset + i - 2; // from dayOffset - 2 to dayOffset + 2
    const dt = getAdjacentDate(selectedDate, d);
    let name = "";
    if (d === 0) name = "Today";
    else if (d === -1) name = "Yesterday";
    else if (d === 1) name = "Tomorrow";
    else name = new Date(dt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { date: dt, name, isActive: dt === selectedDate };
  });

  const centerDate = getAdjacentDate(selectedDate, dayOffset);

  const scheduled = (date: string) => tasks.filter(t => t.date === date && !!t.startTime);
  const unscheduled = tasks.filter(t => t.date === selectedDate && !t.startTime && !t.completed);

  // Auto-scroll to first task of the selected day on mount/date change
  useEffect(() => {
    if (scrollRef.current) {
      const centerTasks = scheduled(centerDate);
      if (centerTasks.length > 0) {
        const earliest = Math.min(...centerTasks.map(t => toMins(t.startTime)));
        scrollRef.current.scrollLeft = Math.max(0, earliest * PPM - 90);
      } else {
        scrollRef.current.scrollLeft = 8 * 60 * PPM; // fallback to 8 AM
      }
    }
  }, [centerDate]);

  const handleMove = useCallback((id: string, s: number, e: number) => onUpdateTask(id, { startTime: toTime(s), endTime: toTime(e) }), [onUpdateTask]);
  const handleResizeLeft = useCallback((id: string, s: number) => onUpdateTask(id, { startTime: toTime(s) }), [onUpdateTask]);
  const handleResizeRight = useCallback((id: string, e: number) => onUpdateTask(id, { endTime: toTime(e) }), [onUpdateTask]);
  const handleUnschedule = useCallback((id: string) => onUpdateTask(id, { startTime: undefined, endTime: undefined }), [onUpdateTask]);

  // ── Sidebar card drag ────────────────────────────────────────────────────
  const startSidebarDrag = useCallback((e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setSidebarDragId(taskId);
    setAnyDragging(true);

    const task = tasks.find(t => t.id === taskId);
    const s = getS(task?.category ?? 'General');

    // Build ghost element — straight, no tilt
    const ghost = document.createElement('div');
    ghost.style.cssText = [
      'position:fixed;z-index:9999;pointer-events:none;',
      'padding:8px 12px;border-radius:10px;border-width:2px;border-style:solid;',
      'font-size:12px;font-weight:800;',
      'backdrop-filter:blur(12px);',
      'box-shadow:0 20px 48px rgba(0,0,0,0.6);',
      'transform:scale(1.06);',  // No rotate — stays parallel to UI
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
        ghostRef.current.style.top = `${ev.clientY - 24}px`;
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
        const leftD = ev.clientX - br.left;
        if (rightD > 0 && rightD < SCROLL_ZONE) scrollRef.current.scrollLeft += Math.ceil((SCROLL_ZONE - rightD) / 5);
        if (leftD > 0 && leftD < SCROLL_ZONE) scrollRef.current.scrollLeft -= Math.ceil((SCROLL_ZONE - leftD) / 5);

        // Find track being hovered for drop preview
        if (ev.clientX >= br.left && ev.clientX <= br.right && ev.clientY >= br.top && ev.clientY <= br.bottom) {
          const dropX = ev.clientX - br.left + scrollRef.current.scrollLeft - 16;
          const dropM = snap(Math.max(0, dropX / PPM));
          let foundDate = null;
          // In a multi-track layout, find which track element the cursor is over
          // Since daysInfo holds the dates, we check track DOM nodes by id
          for (let i = -2; i <= 2; i++) {
            const dateStr = getAdjacentDate(selectedDate, dayOffset + i);
            const el = document.getElementById(`track-${dateStr}`);
            if (el) {
              const r = el.getBoundingClientRect();
              if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
                foundDate = dateStr;
                break;
              }
            }
          }
          // Fallback to selectedDate if couldn't accurately find track
          setDropPreview({ date: foundDate || selectedDate, mins: dropM });
        } else {
          setDropPreview(null);
        }
      }
    };

    const onMu = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMm);
      window.removeEventListener('mouseup', onMu);
      if (ghostRef.current) { document.body.removeChild(ghostRef.current); ghostRef.current = null; }
      setSidebarDragId(null);
      setDropPreview(null);
      setAnyDragging(false);
      setIsOverTrash(false);

      if (scrollRef.current) {
        const br = scrollRef.current.getBoundingClientRect();
        if (ev.clientX >= br.left && ev.clientX <= br.right &&
          ev.clientY >= br.top && ev.clientY <= br.bottom) {
          const dropX = ev.clientX - br.left + scrollRef.current.scrollLeft - 16;
          const dropM = snap(Math.max(0, dropX / PPM));
          onUpdateTask(taskId, {
            startTime: toTime(dropM),
            endTime: toTime(Math.min(TOTAL_MINS, dropM + 60)),
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
    setIsOverTrash,
  };

  return (
    <div className="flex gap-5 h-full flex-col md:flex-row select-none overflow-hidden">

      {/* Sidebar — fixed width, full height, header pinned + cards scroll */}
      <div className="w-full md:w-56 flex-shrink-0 flex flex-col h-full">
        <div className="bg-slate-800/50 rounded-xl border border-white/5 backdrop-blur-sm shadow-xl flex flex-col h-full overflow-hidden">
          {/* Pinned header */}
          <div className="px-4 pt-4 pb-2 border-b border-white/5 flex-shrink-0">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unscheduled</h3>
          </div>
          {/* Scrollable cards */}
          <div className="flex flex-col gap-2.5 p-4 overflow-y-auto flex-1 min-h-0">
            {unscheduled.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-white/10">All tasks scheduled!</p>
            )}
            {unscheduled.map(task => {
              const s = getS(task.category);
              return (
                <div
                  key={task.id}
                  onMouseDown={(e) => startSidebarDrag(e, task.id)}
                  className={`p-3 rounded-xl border-2 cursor-grab bg-gradient-to-br ${s.bg} ${s.border} ${s.text} transition-all duration-150 shadow-md flex-shrink-0 ${sidebarDragId === task.id ? 'opacity-30 scale-95' : 'hover:scale-[1.02] hover:shadow-lg'
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
      <div className="flex-1 flex flex-col gap-2.5 min-w-0 relative group/board">
        {/* Up/Down Navigation Arrows */}
        <div className="absolute right-4 top-4 z-20 flex gap-2">
          {dayOffset > -9 && (
            <button 
              onClick={() => setDayOffset(p => Math.max(-9, p - 3))}
              className="w-8 h-8 rounded-full bg-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-600 flex items-center justify-center transition-all duration-300 backdrop-blur-sm shadow-lg opacity-0 group-hover/board:opacity-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
          )}
          {dayOffset < 9 && (
            <button 
              onClick={() => setDayOffset(p => Math.min(9, p + 3))}
              className="w-8 h-8 rounded-full bg-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-600 flex items-center justify-center transition-all duration-300 backdrop-blur-sm shadow-lg opacity-0 group-hover/board:opacity-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          )}
        </div>

        {/* Scrollable board */}
        <div
          ref={scrollRef}
          className="flex-1 bg-slate-900/40 rounded-2xl border border-white/5 p-4 overflow-x-auto overflow-y-hidden custom-scrollbar flex flex-col"
          style={{ userSelect: 'none' }}
        >
          <div className="relative flex flex-col flex-1 min-h-full" style={{ width: BOARD_WIDTH, paddingBottom: 20 }}>

            {/* Hour grid */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 49 }).map((_, i) => (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 z-0 ${i % 2 === 0 ? 'border-l border-white/[0.06]' : 'border-l border-white/[0.025] border-dashed'}`}
                  style={{ left: i * 30 * PPM }}
                >
                  {i % 2 === 0 && (
                    <span className="text-[9px] font-semibold text-slate-600 bg-slate-900/50 px-1 pt-0.5 block leading-tight sticky top-0">
                      {String(i / 2).padStart(2, '0')}:00
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Tracks */}
            <div className="relative z-10 pt-5 space-y-0.5 flex flex-col flex-1 h-full">
              {daysInfo.map((info) => {
                const trackTasks = [...scheduled(info.date)];
                if (dropPreview && dropPreview.date === info.date && sidebarDragId) {
                  const draggedTask = tasks.find(t => t.id === sidebarDragId);
                  if (draggedTask) {
                    trackTasks.push({
                      ...draggedTask,
                      id: 'ghost-preview',
                      startTime: toTime(dropPreview.mins),
                      endTime: toTime(Math.min(TOTAL_MINS, dropPreview.mins + 60))
                    } as any);
                  }
                }

                return (
                  <Track
                    key={info.date}
                    date={info.date}
                    name={info.name}
                    trackTasks={trackTasks}
                    isActiveDay={info.isActive}
                    {...commonTrackProps}
                  />
                );
              })}
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
              className={`flex-shrink-0 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-all duration-200 overflow-hidden ${isOverTrash
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

        @keyframes task-fill {
          0% { transform: scaleX(0); opacity: 0.8; }
          40% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        .animate-task-fill {
          animation: task-fill 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes task-done-text {
          0%, 30% { opacity: 0; transform: scale(0.8) translateY(4px); }
          45% { opacity: 1; transform: scale(1.1) translateY(0); }
          55% { opacity: 1; transform: scale(1) translateY(0); }
          90% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(-2px); }
        }
        .animate-task-done-text {
          animation: task-done-text 2.5s ease-out forwards;
        }

        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer-sweep 3s infinite ease-in-out;
        }

        @keyframes task-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .task-pulse {
          animation: task-pulse-ring 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default ScheduleBoard;

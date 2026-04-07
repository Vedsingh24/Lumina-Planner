import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Note, DraggableImage } from '../types';

interface NotesTakerProps {
  notes: Note[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onAddNote: (note: Note) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
}

// ─── A4 constants (fixed, zoom-independent) ───────────────────────────────────
const A4_W = 794;           // A4 width in px at 96dpi
const A4_H = 1123;          // A4 height in px at 96dpi
const PAD_H = 80;           // horizontal padding each side (≈20mm)
const PAD_TOP_P1 = 72;      // top padding on page 1 (date header + gap)
const PAD_TOP = 40;         // top padding on subsequent pages
const PAD_BOT = 40;         // bottom padding (page number badge)
const CONTENT_W = A4_W - PAD_H * 2;   // 634px — the writable line width

// Line metrics — must match the CSS applied to .ql-editor in the preview
const FONT_SIZE_REM = 1.4;
const BASE_FONT_PX = 16;
const LINE_HEIGHT_MULT = 2.0;
const LINE_H = FONT_SIZE_REM * BASE_FONT_PX * LINE_HEIGHT_MULT; // 44.8px

// How many lines fit on page 1 vs subsequent pages
const PAGE1_CONTENT_H = A4_H - PAD_TOP_P1 - PAD_BOT;
const PAGEN_CONTENT_H = A4_H - PAD_TOP    - PAD_BOT;
const LINES_PER_PAGE1 = Math.floor(PAGE1_CONTENT_H / LINE_H); // ≈22
const LINES_PER_PAGEN = Math.floor(PAGEN_CONTENT_H / LINE_H); // ≈23
// ─────────────────────────────────────────────────────────────────────────────

const NotesTaker: React.FC<NotesTakerProps> = ({
  notes,
  selectedDate,
  onSelectDate,
  onAddNote,
  onUpdateNote,
  onDeleteNote
}) => {
  const currentNote = useMemo(
    () => notes.find(n => n.date === selectedDate),
    [notes, selectedDate]
  );

  const [text, setText] = useState(currentNote?.text || '');
  const [images, setImages] = useState<DraggableImage[]>(currentNote?.images || []);

  // Zoom is purely visual — it never changes how content is laid out
  const [zoom, setZoom] = useState(0.75);

  const isSyncing = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when date changes
  useEffect(() => {
    isSyncing.current = true;
    const note = notes.find(n => n.date === selectedDate);
    setText(note?.text || '');
    setImages(note?.images || []);
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, [selectedDate, notes]);

  // Debounced auto-save
  const performSave = useCallback(
    (currentText: string, currentImages: DraggableImage[]) => {
      if (isSyncing.current) return;
      const existingNote = notes.find(n => n.date === selectedDate);
      if (existingNote) {
        if (
          existingNote.text === currentText &&
          JSON.stringify(existingNote.images) === JSON.stringify(currentImages)
        ) return;
        onUpdateNote(existingNote.id, { text: currentText, images: currentImages });
      } else if (currentText.trim() || currentImages.length > 0) {
        onAddNote({
          id: crypto.randomUUID(),
          text: currentText,
          date: selectedDate,
          images: currentImages,
          createdAt: new Date().toISOString()
        });
      }
    },
    [selectedDate, notes, onUpdateNote, onAddNote]
  );

  useEffect(() => {
    if (isSyncing.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => performSave(text, images), 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [text, images, performSave]);

  // ─── Image overlay ──────────────────────────────────────────────────────────
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [resizingImageId, setResizingImageId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const addOverlayImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => [...prev, {
          id: crypto.randomUUID(),
          dataUrl: ev.target?.result as string,
          x: 50, y: 50, width: 200, height: 200
        }]);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const deleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handlePointerDown = (
    e: React.PointerEvent, img: DraggableImage, action: 'drag' | 'resize'
  ) => {
    e.stopPropagation(); e.preventDefault();
    if (action === 'drag') {
      setDraggingImageId(img.id);
      setDragOffset({ x: e.clientX - img.x, y: e.clientY - img.y });
    } else {
      setResizingImageId(img.id);
      setDragOffset({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingImageId) {
      setImages(prev => prev.map(img =>
        img.id === draggingImageId
          ? { ...img, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
          : img
      ));
    } else if (resizingImageId) {
      setImages(prev => prev.map(img => {
        if (img.id !== resizingImageId) return img;
        const dx = e.clientX - dragOffset.x;
        const dy = e.clientY - dragOffset.y;
        setDragOffset({ x: e.clientX, y: e.clientY });
        return { ...img, width: Math.max(50, img.width + dx), height: Math.max(50, img.height + dy) };
      }));
    }
  };

  const handlePointerUp = () => {
    setDraggingImageId(null);
    setResizingImageId(null);
  };

  // ─── Quill config ───────────────────────────────────────────────────────────
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      ['clean']
    ],
  };

  // ─── Fixed handwritten style (NEVER changes with zoom) ─────────────────────
  const handwrittenStyle: React.CSSProperties = {
    fontFamily: '"Dancing Script", cursive',
    color: '#38bdf8',
    lineHeight: String(LINE_HEIGHT_MULT),
    letterSpacing: '0.04em',
    fontSize: `${FONT_SIZE_REM}rem`,   // FIXED — zoom does NOT change this
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  };

  // ─── Line-based pagination ─────────────────────────────────────────────────
  // Measure total content height in a hidden div at FIXED font-size and FIXED width.
  // Zoom never triggers this — pagination is purely content-driven.
  const measureRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const totalHeightPx = measureRef.current.scrollHeight;
    const totalLines = Math.ceil(totalHeightPx / LINE_H);
    // Subtract page-1 lines, then divide remainder into subsequent pages
    if (totalLines <= LINES_PER_PAGE1) {
      setPageCount(1);
    } else {
      const remainingLines = totalLines - LINES_PER_PAGE1;
      setPageCount(1 + Math.ceil(remainingLines / LINES_PER_PAGEN));
    }
  }, [text]); // Only text matters — zoom does NOT affect pagination

  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => i),
    [pageCount]
  );

  // ─── Export ─────────────────────────────────────────────────────────────────
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDates, setExportDates] = useState<string[]>([]);
  const availableDates = useMemo(
    () => Array.from(new Set(notes.map(n => n.date).filter(Boolean))) as string[],
    [notes]
  );

  const toggleExportDate = (date: string) =>
    setExportDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );

  const executePrint = async () => {
    setIsExportModalOpen(false);
    const selectedNotes = exportDates
      .map(date =>
        date === selectedDate
          ? { id: currentNote?.id || crypto.randomUUID(), text, images, date: selectedDate, createdAt: currentNote?.createdAt || new Date().toISOString() } as Note
          : notes.find(n => n.date === date)
      )
      .filter(Boolean) as Note[];

    let pagesHtml = '';
    for (const note of selectedNotes) {
      const imagesHtml = (note.images || [])
        .map(img => `<img src="${img.dataUrl}" style="position:absolute;left:${img.x}px;top:${img.y + 60}px;width:${img.width}px;height:${img.height}px;object-fit:cover;border-radius:4px;" />`)
        .join('');

      pagesHtml += `
        <div style="position:relative;width:210mm;height:297mm;padding:20mm;page-break-after:always;background:#0f172a;color:#38bdf8;font-family:'Dancing Script',cursive;font-size:1.4rem;line-height:2.0;overflow:hidden;">
          <div style="text-align:right;color:#475569;font-size:12px;font-family:'Inter',sans-serif;letter-spacing:0.1em;text-transform:uppercase;border-bottom:1px solid #1e293b;padding-bottom:8px;margin-bottom:24px;">${note.date}</div>
          <div class="ql-editor" style="padding:0;word-break:break-word;overflow-wrap:break-word;">${note.text}</div>
          ${imagesHtml}
        </div>`;
    }

    const fullHtml = `<!DOCTYPE html><html><head>
      <title>Lumina Journal Export</title>
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .ql-editor { font-family: 'Dancing Script', cursive !important; color: #38bdf8 !important; font-size: 1.4rem !important; line-height: 2.0 !important; word-break: break-word !important; }
      </style>
    </head><body>${pagesHtml}</body></html>`;

    try {
      const electron = (window as any).require?.('electron');
      if (electron?.ipcRenderer) {
        const success = await electron.ipcRenderer.invoke('export-to-pdf', fullHtml);
        if (!success) console.log('PDF Export cancelled or failed');
      }
    } catch (err) {
      console.error('Export Error:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020617] relative animate-in fade-in duration-500 rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-white/5 glass-panel z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Daily Journal</h2>
          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-xs font-bold tracking-widest text-blue-400 uppercase">{selectedDate}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-white/5 mr-4">
            <button onClick={() => setZoom(z => Math.max(0.4, parseFloat((z - 0.1).toFixed(1))))} className="p-1 hover:bg-slate-700 rounded text-slate-400 transition-colors" title="Zoom Out">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span className="text-[10px] font-bold text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))} className="p-1 hover:bg-slate-700 rounded text-slate-400 transition-colors" title="Zoom In">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <button onClick={() => { setExportDates([selectedDate]); setIsExportModalOpen(true); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 border border-white/5 shadow-lg shadow-black/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        {/* Sidebar */}
        <div className="w-36 lg:w-44 border-r border-white/5 bg-slate-900/40 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">History</div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {availableDates.length === 0 ? (
              <div className="text-[10px] text-slate-600 p-2 italic">No notes yet</div>
            ) : (
              [...availableDates].sort((a, b) => b.localeCompare(a)).map(date => (
                <button
                  key={date}
                  onClick={() => onSelectDate(date)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${selectedDate === date ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:bg-white/5'}`}
                >
                  {date}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 flex flex-col md:flex-row min-h-0 relative"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Left: Quill Editor */}
          <div className="w-full md:w-1/2 flex flex-col border-r border-white/5 bg-slate-900/20 relative z-10 overflow-hidden quill-container">
            <ReactQuill
              theme="snow"
              value={text}
              onChange={setText}
              modules={modules}
              placeholder="Start journaling here..."
              className="h-full flex flex-col"
            />
          </div>

          {/* Right: A4 Preview — zoom is purely visual (transform: scale) */}
          <div className="w-full md:w-1/2 bg-slate-950 relative overflow-hidden flex flex-col">

            {/* Image button */}
            <div className="absolute top-0 w-full h-10 flex items-center justify-end px-4 z-20 pointer-events-none">
              <button
                onClick={addOverlayImage}
                className="pointer-events-auto px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded transition-colors flex items-center gap-1.5 text-xs font-black uppercase tracking-widest border border-blue-500/20 backdrop-blur-sm"
                title="Add Draggable Image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Image
              </button>
            </div>

            {/*
              Hidden measurement div:
              - FIXED width = CONTENT_W (no zoom)
              - FIXED font-size = 1.4rem (no zoom)
              - Same line-height, font-family as preview
              Measures the true line count so pagination never depends on zoom.
            */}
            <div
              ref={measureRef}
              aria-hidden="true"
              className="ql-editor preview-measure"
              style={{
                position: 'absolute',
                visibility: 'hidden',
                pointerEvents: 'none',
                top: 0, left: 0,
                width: `${CONTENT_W}px`,
                ...handwrittenStyle,
                padding: 0,
              }}
              dangerouslySetInnerHTML={{ __html: text }}
            />

            {/* Scrollable pages container */}
            <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar pt-12 pb-4 px-6 bg-slate-950 flex flex-col items-center gap-8">
              {pages.map((pageIdx) => {
                const isFirst = pageIdx === 0;
                const contentH = isFirst ? PAGE1_CONTENT_H : PAGEN_CONTENT_H;
                const padTop = isFirst ? PAD_TOP_P1 : PAD_TOP;
                // How many lines have already been consumed by previous pages
                const linesConsumed = isFirst
                  ? 0
                  : LINES_PER_PAGE1 + (pageIdx - 1) * LINES_PER_PAGEN;
                const translateY = linesConsumed * LINE_H;

                return (
                  /*
                    Outer wrapper: gives the page its layout footprint after zoom.
                    Width and height match the SCALED A4 card so the flex container
                    doesn't collapse. Content inside transforms via scale().
                  */
                  <div
                    key={pageIdx}
                    style={{
                      width: `${A4_W * zoom}px`,
                      height: `${A4_H * zoom}px`,
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {/*
                      Inner A4 card: always rendered at FULL A4 size (794×1123px),
                      then scaled visually. Font sizes, line heights, padding — all
                      remain constant. Only the visual size changes.
                    */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        width: `${A4_W}px`,
                        height: `${A4_H}px`,
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        backgroundColor: '#0f172a',
                        borderRadius: '2px',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Date header — page 1 only */}
                      {isFirst && (
                        <div style={{
                          textAlign: 'right',
                          color: '#475569',
                          fontSize: '12px',
                          fontFamily: "'Inter', sans-serif",
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #1e293b',
                          paddingBottom: '8px',
                          margin: '32px 80px 0',
                        }}>
                          {selectedDate}
                        </div>
                      )}

                      {/* Content clip window */}
                      <div style={{
                        position: 'absolute',
                        top: `${padTop}px`,
                        left: `${PAD_H}px`,
                        width: `${CONTENT_W}px`,
                        height: `${contentH}px`,
                        overflow: 'hidden',
                      }}>
                        {/*
                          Translate the content upward by exactly the number of
                          lines already consumed by previous pages. Uses fixed
                          LINE_H — unaffected by zoom.
                        */}
                        <div
                          className="ql-editor"
                          style={{
                            ...handwrittenStyle,
                            padding: 0,
                            transform: `translateY(-${translateY}px)`,
                            transformOrigin: 'top left',
                          }}
                          dangerouslySetInnerHTML={{ __html: text }}
                        />

                        {/* Overlay images on page 1 */}
                        {isFirst && images.map(img => (
                          <div
                            key={img.id}
                            className="absolute z-20 group"
                            style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
                          >
                            <img src={img.dataUrl} className="w-full h-full object-cover rounded shadow-md pointer-events-none" draggable={false} alt="Overlay" />
                            <div className="absolute inset-0 cursor-move border-2 border-transparent group-hover:border-blue-400/50 transition-colors" onPointerDown={e => handlePointerDown(e, img, 'drag')} />
                            <div className="absolute -right-2 -bottom-2 w-5 h-5 bg-blue-500 rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center pointer-events-auto" onPointerDown={e => handlePointerDown(e, img, 'resize')}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                            </div>
                            <button onClick={e => deleteImage(img.id, e)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center pointer-events-auto hover:bg-red-400">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Page number badge */}
                      <div style={{
                        position: 'absolute',
                        bottom: '14px',
                        right: `${PAD_H}px`,
                        fontSize: '10px',
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 900,
                        letterSpacing: '0.3em',
                        textTransform: 'uppercase',
                        color: 'rgba(71,85,105,0.55)',
                      }}>
                        Page {pageIdx + 1} of {pageCount}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-2">Export Notes</h3>
            <p className="text-sm text-slate-400 mb-6">Select which days to save as PDF.</p>
            <div className="bg-slate-800/50 rounded-xl max-h-48 overflow-y-auto mb-6 p-2 border border-slate-700/50">
              {availableDates.length === 0 ? (
                <p className="text-sm text-slate-500 p-2 text-center italic">No saved notes found.</p>
              ) : (
                availableDates.map(date => {
                  const noteItem = date === selectedDate ? { text } : notes.find(n => n.date === date);
                  const previewText = noteItem?.text?.replace(/<[^>]*>/g, ' ').substring(0, 60) || 'Empty Note';
                  return (
                    <label key={date} className="flex flex-col p-3 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-medium">{date}</span>
                        <input type="checkbox" checked={exportDates.includes(date)} onChange={() => toggleExportDate(date)} className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700 accent-blue-500" />
                      </div>
                      <span className="text-xs text-slate-500 mt-1 truncate italic">"{previewText}..."</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={executePrint} disabled={exportDates.length === 0} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-800 text-white rounded-xl shadow-lg shadow-blue-500/20 font-bold tracking-wide transition-all">
                Print Selection
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        /* ─── Quill Toolbar ─────────────────────────────────────────────── */
        .quill-container .ql-toolbar.ql-snow { border: none; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(15,23,42,0.8); padding: 4px 8px; }
        .quill-container .ql-container.ql-snow { border: none; flex: 1; overflow-y: auto; overflow-x: hidden; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #cbd5e1; }
        .quill-container .ql-editor { padding: 24px; min-height: 100%; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap; }
        .quill-container .ql-editor.ql-blank::before { color: #475569; font-style: normal; }
        .quill-container .ql-snow .ql-stroke { stroke: #94a3b8; }
        .quill-container .ql-snow .ql-fill { fill: #94a3b8; }
        .quill-container .ql-snow .ql-picker { color: #94a3b8; }
        .quill-container .ql-snow .ql-picker-options { background: #0f172a; border-color: rgba(255,255,255,0.1); }

        /* ─── Editor: Headings ──────────────────────────────────────────── */
        .quill-container .ql-editor h1 {
          font-size: 2rem !important;
          font-weight: 800 !important;
          color: #f1f5f9 !important;
          line-height: 1.3 !important;
          margin-bottom: 0.5em !important;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 0.3em;
        }
        .quill-container .ql-editor h2 {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          color: #e2e8f0 !important;
          line-height: 1.4 !important;
          margin-bottom: 0.4em !important;
        }
        .quill-container .ql-editor h3 {
          font-size: 1.2rem !important;
          font-weight: 600 !important;
          color: #cbd5e1 !important;
          line-height: 1.4 !important;
          margin-bottom: 0.3em !important;
        }

        /* ─── Editor: Bold & Italic ─────────────────────────────────────── */
        .quill-container .ql-editor strong,
        .quill-container .ql-editor b {
          font-weight: 800 !important;
          color: #f8fafc !important;
        }
        .quill-container .ql-editor em,
        .quill-container .ql-editor i {
          font-style: italic !important;
          color: #7dd3fc !important;
        }

        /* ─── Editor: Lists ─────────────────────────────────────────────── */
        .quill-container .ql-editor ol,
        .quill-container .ql-editor ul {
          padding-left: 1.5em !important;
          margin: 0.4em 0 !important;
        }
        .quill-container .ql-editor ul > li::before {
          content: '\\2022' !important;
          color: #3b82f6 !important;
          font-weight: bold !important;
          margin-right: 0.5em !important;
        }
        .quill-container .ql-editor ol > li {
          list-style-type: decimal !important;
          padding-left: 0.3em !important;
        }
        .quill-container .ql-editor li {
          padding-left: 0.3em !important;
        }

        /* ─── Editor: Indent ────────────────────────────────────────────── */
        .quill-container .ql-editor .ql-indent-1 { padding-left: 2em !important; }
        .quill-container .ql-editor .ql-indent-2 { padding-left: 4em !important; }
        .quill-container .ql-editor .ql-indent-3 { padding-left: 6em !important; }
        .quill-container .ql-editor .ql-indent-4 { padding-left: 8em !important; }
        .quill-container .ql-editor .ql-indent-5 { padding-left: 10em !important; }

        /* ─── Preview: Headings ─────────────────────────────────────────── */
        .preview-measure h1, div.ql-editor:not(.quill-container .ql-editor) h1 {
          font-family: 'Dancing Script', cursive;
          font-size: 2.2rem !important;
          font-weight: 700 !important;
          line-height: 1.5 !important;
          margin-bottom: 0.3em;
        }
        .preview-measure h2, div.ql-editor:not(.quill-container .ql-editor) h2 {
          font-family: 'Dancing Script', cursive;
          font-size: 1.8rem !important;
          font-weight: 700 !important;
          line-height: 1.6 !important;
          margin-bottom: 0.2em;
        }
        .preview-measure h3, div.ql-editor:not(.quill-container .ql-editor) h3 {
          font-family: 'Dancing Script', cursive;
          font-size: 1.6rem !important;
          font-weight: 700 !important;
          line-height: 1.7 !important;
          margin-bottom: 0.2em;
        }

        /* ─── Preview: Bold & Italic ────────────────────────────────────── */
        div.ql-editor:not(.quill-container .ql-editor) strong,
        div.ql-editor:not(.quill-container .ql-editor) b {
          font-weight: 700 !important;
        }
        div.ql-editor:not(.quill-container .ql-editor) em,
        div.ql-editor:not(.quill-container .ql-editor) i {
          font-style: italic !important;
        }

        /* ─── Preview: Lists ────────────────────────────────────────────── */
        div.ql-editor:not(.quill-container .ql-editor) ol,
        div.ql-editor:not(.quill-container .ql-editor) ul {
          padding-left: 1.5em !important;
        }
        div.ql-editor:not(.quill-container .ql-editor) ul > li::before {
          content: '\\2022' !important;
          margin-right: 0.5em !important;
        }
        div.ql-editor:not(.quill-container .ql-editor) ol > li {
          list-style-type: decimal !important;
        }

        /* ─── Preview: Indent ───────────────────────────────────────────── */
        div.ql-editor:not(.quill-container .ql-editor) .ql-indent-1 { padding-left: 2em !important; }
        div.ql-editor:not(.quill-container .ql-editor) .ql-indent-2 { padding-left: 4em !important; }
        div.ql-editor:not(.quill-container .ql-editor) .ql-indent-3 { padding-left: 6em !important; }

        .preview-measure p, .preview-measure li {
          font-family: 'Dancing Script', cursive;
          font-size: 1.4rem;
          line-height: 2.0;
          word-break: break-word;
          overflow-wrap: break-word;
        }

        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap');
      `}} />
    </div>
  );
};

export default NotesTaker;

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Note, DraggableImage } from '../types';

interface NotesTakerProps {
  notes: Note[];
  selectedDate: string;
  onAddNote: (note: Note) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
}

const NotesTaker: React.FC<NotesTakerProps> = ({ notes, selectedDate, onAddNote, onUpdateNote, onDeleteNote }) => {
  const currentNote = notes.find(n => n.date === selectedDate);

  const [text, setText] = useState(currentNote?.text || '');
  const [images, setImages] = useState<DraggableImage[]>(currentNote?.images || []);
  
  // Track whether a save is needed vs. external sync
  const isSyncing = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when selectedDate or notes change externally
  useEffect(() => {
    isSyncing.current = true;
    const note = notes.find(n => n.date === selectedDate);
    setText(note?.text || '');
    setImages(note?.images || []);
    // Small delay to allow state to settle before re-enabling saves
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, [selectedDate]);

  // Debounced auto-save — only triggers from user edits, not from external sync
  const performSave = useCallback((currentText: string, currentImages: DraggableImage[]) => {
    if (isSyncing.current) return;
    if (!currentText.trim() && currentImages.length === 0) return;

    const existingNote = notes.find(n => n.date === selectedDate);
    if (existingNote) {
      onUpdateNote(existingNote.id, { text: currentText, images: currentImages });
    } else {
      onAddNote({
        id: crypto.randomUUID(),
        text: currentText,
        date: selectedDate,
        images: currentImages,
        createdAt: new Date().toISOString()
      });
    }
  }, [selectedDate, notes, onUpdateNote, onAddNote]);

  useEffect(() => {
    if (isSyncing.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => performSave(text, images), 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [text, images, performSave]);

  // --- Formatting Injectors ---
  const insertFormatting = (prefix: string, suffix: string) => {
    const textarea = document.getElementById('note-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const newText = currentText.substring(0, start) + prefix + currentText.substring(start, end) + suffix + currentText.substring(end);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  // --- Image Overlay Logic ---
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [resizingImageId, setResizingImageId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const previewRef = useRef<HTMLDivElement>(null);

  const addOverlayImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const newImg: DraggableImage = {
            id: crypto.randomUUID(),
            dataUrl: event.target?.result as string,
            x: 50, y: 50, width: 200, height: 200
          };
          setImages(prev => [...prev, newImg]);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const deleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handlePointerDown = (e: React.PointerEvent, img: DraggableImage, action: 'drag' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
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
      setImages(prev => prev.map(img => {
        if (img.id === draggingImageId) {
          return { ...img, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        }
        return img;
      }));
    } else if (resizingImageId) {
      setImages(prev => prev.map(img => {
        if (img.id === resizingImageId) {
          const deltaX = e.clientX - dragOffset.x;
          const deltaY = e.clientY - dragOffset.y;
          setDragOffset({ x: e.clientX, y: e.clientY });
          return { ...img, width: Math.max(50, img.width + deltaX), height: Math.max(50, img.height + deltaY) };
        }
        return img;
      }));
    }
  };

  const handlePointerUp = () => {
    setDraggingImageId(null);
    setResizingImageId(null);
  };

  // --- Parse Text to HTML ---
  const parseTextToHtml = (rawText: string) => {
    let html = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[color:(.*?)]((?:(?!\[\/color\]).)*)\[\/color]/g, '<span style="color: $1">$2</span>');
    return { __html: html };
  };

  // Dancing Script — stylized, beautiful cursive font
  const handwrittenStyle: React.CSSProperties = {
    fontFamily: '"Dancing Script", cursive',
    color: '#38bdf8', // Bright sky blue — vivid and lively
    lineHeight: '2.0',
    letterSpacing: '0.04em',
    fontSize: '1.4rem',
  };

  // --- Bullet Handling ---
  const insertBullet = () => {
    const textarea = document.getElementById('note-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const currentText = textarea.value;
    // Determine if we need a newline before the bullet
    const prevChar = start > 0 ? currentText[start - 1] : '\n';
    const prefix = prevChar === '\n' || start === 0 ? '• ' : '\n• ';
    const newText = currentText.substring(0, start) + prefix + currentText.substring(start);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    const textarea = e.currentTarget;
    const pos = textarea.selectionStart;
    const val = textarea.value;
    // Find start of current line
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    const currentLine = val.substring(lineStart, pos);
    if (currentLine.startsWith('• ')) {
      e.preventDefault();
      const before = val.substring(0, pos);
      const after = val.substring(pos);
      const newText = before + '\n• ' + after;
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(pos + 3, pos + 3);
      }, 0);
    }
  };

  // --- Preview Pagination ---
  const LINES_PER_PAGE = 60;
  const [previewPage, setPreviewPage] = useState(0);
  const textLines = text.split('\n');
  const totalPreviewPages = Math.max(1, Math.ceil(textLines.length / LINES_PER_PAGE));
  const pageStart = previewPage * LINES_PER_PAGE;
  const pageEnd = pageStart + LINES_PER_PAGE;
  const pageText = textLines.slice(pageStart, pageEnd).join('\n');

  // --- Export Logic ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDates, setExportDates] = useState<string[]>([]);
  const availableDates = Array.from(new Set(notes.map(n => n.date).filter(Boolean))) as string[];
  const printRef = useRef<HTMLDivElement>(null);

  const toggleExportDate = (date: string) => {
    setExportDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const executePrint = () => {
    setIsExportModalOpen(false);
    // Build a printable HTML document in a new window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const selectedNotes = exportDates.map(date => notes.find(n => n.date === date)).filter(Boolean) as Note[];
    
    let pagesHtml = '';
    for (const note of selectedNotes) {
      const textHtml = parseTextToHtml(note.text).__html;
      let imagesHtml = '';
      if (note.images) {
        for (const img of note.images) {
          imagesHtml += `<img src="${img.dataUrl}" style="position:absolute;left:${img.x}px;top:${img.y + 60}px;width:${img.width}px;height:${img.height}px;object-fit:cover;border-radius:4px;" />`;
        }
      }
      pagesHtml += `
        <div style="position:relative;min-height:100vh;padding:40px;page-break-after:always;background:#0f172a;color:#93c5fd;font-family:'Patrick Hand','Kalam',cursive;font-size:1.2rem;line-height:2.2;">
          <div style="text-align:right;color:#475569;font-size:12px;font-family:'Inter',sans-serif;letter-spacing:0.1em;text-transform:uppercase;border-bottom:1px solid #1e293b;padding-bottom:8px;margin-bottom:24px;">${note.date}</div>
          <div>${textHtml}</div>
          ${imagesHtml}
        </div>`;
    }

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
        <title>Lumina Journal Export</title>
        <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
        <style>
          @page { margin: 0; }
          body { margin: 0; padding: 0; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head><body>${pagesHtml}</body></html>
    `);
    printWindow.document.close();
    // Wait for fonts to load then print
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div className="flex flex-col h-full bg-[#020617] relative animate-in fade-in duration-500 rounded-3xl border border-white/5 overflow-hidden">
      {/* Top Header Controls */}
      <div className="flex justify-between items-center p-4 border-b border-white/5 glass-panel z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Daily Journal</h2>
          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-xs font-bold tracking-widest text-blue-400 uppercase">{selectedDate}</span>
        </div>
        <button onClick={() => { setExportDates([selectedDate]); setIsExportModalOpen(true); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 border border-white/5 shadow-lg shadow-black/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Export
        </button>
      </div>

      {/* Overleaf Split Interface */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative"
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
           onPointerLeave={handlePointerUp}>
        
        {/* Left Pane: Raw Editor */}
        <div className="w-full md:w-1/2 flex flex-col border-r border-white/5 bg-slate-900/60 relative z-10">
          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b border-white/5 bg-slate-900/80 flex-wrap">
            <button onClick={() => insertFormatting('**', '**')} className="p-2 hover:bg-white/10 rounded-md text-slate-300 transition-colors" title="Bold"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg></button>
            <button onClick={() => insertFormatting('*', '*')} className="p-2 hover:bg-white/10 rounded-md text-slate-300 transition-colors" title="Italic"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg></button>
            <button
              onClick={insertBullet}
              className="px-2 py-1 text-sm font-bold text-sky-400 hover:bg-white/5 rounded-md transition-colors"
              title="Insert Bullet Point"
            >• Bullet</button>
            <div className="w-px h-4 bg-white/10 mx-1"></div>
            <button onClick={() => insertFormatting('[color:red]', '[/color]')} className="px-2 py-1 text-xs font-bold text-red-400 hover:bg-white/5 rounded-md transition-colors" title="Red Text">Red</button>
            <button onClick={() => insertFormatting('[color:green]', '[/color]')} className="px-2 py-1 text-xs font-bold text-green-400 hover:bg-white/5 rounded-md transition-colors" title="Green Text">Grn</button>
            <button onClick={() => insertFormatting('[color:#f59e0b]', '[/color]')} className="px-2 py-1 text-xs font-bold text-amber-400 hover:bg-white/5 rounded-md transition-colors" title="Yellow Text">Ylw</button>
          </div>
          
          <textarea
            id="note-editor"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            placeholder="Write here... Supports: **bold**, *italic*, [color:red]colored[/color], • bullets"
            className="flex-1 bg-transparent p-6 outline-none text-slate-300 resize-none font-mono text-sm leading-relaxed placeholder:text-slate-600 custom-scrollbar whitespace-pre-wrap break-words overflow-x-hidden"
            spellCheck={false}
          />
        </div>

        {/* Right Pane: Visual Preview (Dark Theme) */}
        <div className="w-full md:w-1/2 bg-[#0f172a] relative overflow-hidden flex flex-col" ref={previewRef}>
          
          {/* Subtle Add Image Button */}
          <div className="absolute top-0 w-full h-12 flex items-center justify-end px-4 z-20 pointer-events-none">
            <button 
              onClick={addOverlayImage}
              className="pointer-events-auto px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded drop-shadow-sm transition-colors flex items-center gap-1.5 text-xs font-black uppercase tracking-widest border border-blue-500/20 backdrop-blur-sm"
              title="Add Draggable Image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              Image
            </button>
          </div>

          {/* Handwritten Document Area — Word-like Pages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar bg-slate-950 flex flex-col items-center gap-8">
            {totalPreviewPages === 0 ? (
                <div 
                  className="w-full max-w-2xl bg-[#0f172a] shadow-2xl border border-white/5 relative flex-shrink-0"
                  style={{ minHeight: '840px', padding: '40px 60px' }}
                />
            ) : (
              Array.from({ length: totalPreviewPages }).map((_, idx) => {
                const pStart = idx * LINES_PER_PAGE;
                const pEnd = pStart + LINES_PER_PAGE;
                const chunk = textLines.slice(pStart, pEnd).join('\n');
                return (
                  <div 
                    key={idx}
                    className="w-full max-w-2xl bg-[#0f172a] shadow-2xl border border-white/5 relative flex-shrink-0 transition-all duration-300"
                    style={{ minHeight: '840px', padding: '40px 60px' }}
                  >
                    <div 
                      className="relative z-10 w-full whitespace-pre-wrap break-words"
                      style={handwrittenStyle}
                      dangerouslySetInnerHTML={parseTextToHtml(chunk)}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Render Overlay Images */}
          {images.map(img => (
            <div 
              key={img.id}
              className="absolute z-20 group"
              style={{ left: img.x, top: img.y, width: img.width, height: img.height }}
            >
              <img src={img.dataUrl} className="w-full h-full object-cover rounded shadow-md pointer-events-none" draggable={false} alt="Overlay" />
              <div 
                className="absolute inset-0 cursor-move border-2 border-transparent group-hover:border-blue-400/50 transition-colors"
                onPointerDown={(e) => handlePointerDown(e, img, 'drag')}
              />
              <div 
                className="absolute -right-2 -bottom-2 w-5 h-5 bg-blue-500 rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center pointer-events-auto"
                onPointerDown={(e) => handlePointerDown(e, img, 'resize')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
              </div>
              <button 
                onClick={(e) => deleteImage(img.id, e)}
                className="absolute -right-2 -top-2 w-5 h-5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center pointer-events-auto hover:bg-red-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Export Dialog Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-2">Export Notes</h3>
            <p className="text-sm text-slate-400 mb-6">Select which days to save as PDF. They will render exactly as the visual preview.</p>
            
            <div className="bg-slate-800/50 rounded-xl max-h-48 overflow-y-auto mb-6 p-2 border border-slate-700/50">
              {availableDates.length === 0 ? (
                <p className="text-sm text-slate-500 p-2 text-center italic">No saved notes found.</p>
              ) : (
                availableDates.map(date => (
                  <label key={date} className="flex items-center justify-between p-3 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-700">
                    <span className="text-slate-200 font-medium">{date}</span>
                    <input 
                      type="checkbox" 
                      checked={exportDates.includes(date)}
                      onChange={() => toggleExportDate(date)}
                      className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700 accent-blue-500"
                    />
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button 
                onClick={executePrint}
                disabled={exportDates.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-800 text-white rounded-xl shadow-lg shadow-blue-500/20 font-bold tracking-wide transition-all"
              >
                Print Selection
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
};

export default NotesTaker;

import React, { useState, useRef, useEffect } from 'react';
import { Note } from '../types';

interface NotesTakerProps {
    notes: Note[];
    onAddNote: (note: Note) => void;
    onUpdateNote: (id: string, updates: Partial<Note>) => void;
    onDeleteNote: (id: string) => void;
}

const NotesTaker: React.FC<NotesTakerProps> = ({ notes, onAddNote, onUpdateNote, onDeleteNote }) => {
    const [inputText, setInputText] = useState('');
    const outputRef = useRef<HTMLDivElement>(null);

    // Custom font style to simulate handwritten text
    const handwrittenStyle = {
        fontFamily: '"Comic Sans MS", "Caveat", "Kalam", cursive, sans-serif',
        color: '#4A90E2',
        lineHeight: '1.8',
        letterSpacing: '0.02em',
        fontSize: '1.1rem'
    };

    const handlePrint = () => {
        window.print();
    };

    const insertFormatting = (before: string, after: string) => {
        const textarea = document.getElementById('note-input') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        const newText = text.substring(0, start) + before + text.substring(start, end) + after + text.substring(end);
        setInputText(newText);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    const parseTextToHtml = (text: string) => {
        // Basic Markdown to HTML parsing for bold and italic
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>');

        return { __html: html };
    };

    const addImageCutout = async () => {
        // In an Electron app, we could trigger a native save dialog via IPC
        // Here we'll just use a basic file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png, image/jpeg, image/webp';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imgHtml = `<div class="my-4 p-2 bg-white/5 border border-white/10 rounded-xl inline-block max-w-full shadow-lg"><img src="${event.target?.result}" class="max-w-full h-auto rounded-lg" alt="Cutout" /></div><br/>`;
                    setInputText(prev => prev + '\n\n' + imgHtml + '\n\n');
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleSave = () => {
        if (!inputText.trim()) return;

        onAddNote({
            id: crypto.randomUUID(),
            text: inputText,
            isCustomHtml: inputText.includes('<img') || inputText.includes('<div'),
            createdAt: new Date().toISOString()
        });

        setInputText('');
    };

    return (
        <div className="flex flex-col h-full bg-[#020617] relative animate-in fade-in duration-500 rounded-3xl border border-white/5 overflow-hidden print:border-none print:bg-white print:text-black">
            {/* Top Header Controls */}
            <div className="flex justify-between items-center p-4 border-b border-white/5 glass-panel print:hidden">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Notes & Journal</h2>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 border border-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Main Output View */}
            <div
                ref={outputRef}
                className="flex-1 overflow-y-auto p-6 md:p-10 hide-scrollbar bg-slate-900/30 print:p-0 print:bg-transparent"
                style={handwrittenStyle}
            >
                {notes.length === 0 && !inputText ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 print:hidden text-slate-400 font-sans">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                        <p>Your beautiful handwritten notes will appear here.</p>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto space-y-8">
                        {notes.map(note => (
                            <div key={note.id} className="relative group">
                                <div
                                    className="prose prose-blue max-w-none text-[#4A90E2] print:text-black break-words"
                                    style={handwrittenStyle}
                                    dangerouslySetInnerHTML={note.isCustomHtml ? { __html: note.text } : parseTextToHtml(note.text)}
                                />
                                <div className="absolute top-0 right-0 -mr-12 opacity-0 group-hover:opacity-100 transition-opacity print:hidden flex flex-col gap-2">
                                    <button onClick={() => onDeleteNote(note.id)} className="p-2 text-slate-500 hover:text-red-400 bg-slate-800 rounded-lg shadow-lg border border-white/5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-2 font-sans tracking-wide uppercase opacity-50 print:hidden border-b border-white/5 pb-8">
                                    {new Date(note.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))}

                        {/* Live Typing Preview */}
                        {inputText && (
                            <div className="border-l-2 border-blue-500/50 pl-4 py-2 animate-pulse-slow">
                                <div
                                    className="prose prose-blue max-w-none text-[#4A90E2] break-words"
                                    style={handwrittenStyle}
                                    dangerouslySetInnerHTML={inputText.includes('<img') || inputText.includes('<div') ? { __html: inputText } : parseTextToHtml(inputText)}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Entry Section */}
            <div className="h-48 md:h-64 border-t border-white/10 bg-slate-900/80 p-4 flex flex-col gap-3 print:hidden backdrop-blur-md">
                <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg w-fit border border-white/5">
                    <button onClick={() => insertFormatting('**', '**')} className="p-2 hover:bg-white/10 rounded-md text-slate-300 transition-colors" title="Bold">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
                    </button>
                    <button onClick={() => insertFormatting('*', '*')} className="p-2 hover:bg-white/10 rounded-md text-slate-300 transition-colors" title="Italic">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>
                    </button>
                    <div className="w-px h-6 bg-white/10 self-center mx-1"></div>
                    <button onClick={addImageCutout} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider" title="Add Image Cutout">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        Cutout
                    </button>
                </div>

                <div className="flex-1 flex gap-4">
                    <textarea
                        id="note-input"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                                handleSave();
                            }
                        }}
                        placeholder="Type your notes here... (Ctrl+Enter to save)"
                        className="flex-1 bg-transparent border-none resize-none text-slate-100 outline-none leading-relaxed placeholder:text-slate-600 font-sans"
                    />
                    <button
                        onClick={handleSave}
                        disabled={!inputText.trim()}
                        className="self-end bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl p-4 shadow-lg shadow-blue-600/20 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>

            {/* Print-specific styles to hide main UI elements and show only the note text */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:text-black {
            color: black !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          /* Make the notes container visible */
          .relative.animate-in {
            position: absolute;
            left: 0;
            top: 0;
            width: 100vw;
            visibility: visible;
          }
          /* Only make the handwritten notes text visible */
          .relative.animate-in .flex-1, 
          .relative.animate-in .flex-1 * {
            visibility: visible;
          }
          /* Hide the 'no notes' empty state just in case */
          .relative.animate-in .h-full.flex.flex-col.items-center {
            display: none !important;
          }
        }
      `}} />
        </div>
    );
};

export default NotesTaker;

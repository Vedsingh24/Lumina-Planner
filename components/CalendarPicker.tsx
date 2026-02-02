import React, { useState } from 'react';
import { Task } from '../types';

interface CalendarPickerProps {
    selectedDate: string;
    onSelectDate: (date: string) => void;
    tasks: Task[];
    onClose: () => void;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({ selectedDate, onSelectDate, tasks, onClose }) => {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }

    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    const handleDateClick = (date: Date) => {
        // Correct for timezone offset issues when stringifying
        // Use local YYYY-MM-DD
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        const dateStr = localDate.toISOString().split('T')[0];
        onSelectDate(dateStr);
        onClose();
    };

    const hasTasks = (date: Date) => {
        const dayStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD local
        // Actually simpler: 
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${d}`;
        return tasks.some(t => t.date === iso && !t.completed); // Only dots for pending? User said "inputted tasks", implied existence.
        // "maybe with inforamtion on which dates the user inputted tasks"
        // Let's check for ANY task
        return tasks.some(t => t.date === iso);
    };

    const getTaskStatusColor = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${d}`;

        const dateTasks = tasks.filter(t => t.date === iso);
        if (dateTasks.length === 0) return null;

        const hasPending = dateTasks.some(t => !t.completed);
        return hasPending ? 'bg-blue-500' : 'bg-green-500';
    };

    return (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 p-4 bg-slate-900/95 border border-blue-500/20 rounded-2xl shadow-xl backdrop-blur-xl w-[320px] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="p-1 hover:text-blue-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <h3 className="font-bold text-white">
                    {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={handleNextMonth} className="p-1 hover:text-blue-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div key={day} className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {days.map((date, i) => {
                    if (!date) return <div key={`empty-${i}`} className="p-2"></div>;

                    const isSelected = date.getDate() === new Date(selectedDate).getDate() &&
                        date.getMonth() === new Date(selectedDate).getMonth() &&
                        date.getFullYear() === new Date(selectedDate).getFullYear();

                    const statusColor = getTaskStatusColor(date);

                    return (
                        <button
                            key={i}
                            onClick={() => handleDateClick(date)}
                            className={`relative p-2 text-sm rounded-lg font-medium transition-all hover:bg-white/5 ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-300'
                                }`}
                        >
                            {date.getDate()}
                            {statusColor && !isSelected && (
                                <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${statusColor}`}></div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Click outside backdrop is handled by parent or transparent overlay */}
        </div>
    );
};

export default CalendarPicker;

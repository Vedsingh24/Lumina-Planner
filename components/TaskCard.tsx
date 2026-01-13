
import React from 'react';
import { Task, Priority } from '../types';

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
  onRate: (id: string, rating: number) => void;
  onDelete: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onRate, onDelete }) => {
  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className={`group relative p-4 rounded-xl border transition-all duration-300 ${
      task.completed 
        ? 'bg-slate-800/40 border-slate-700 opacity-75' 
        : 'bg-slate-800 border-slate-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button 
            onClick={() => onToggle(task.id)}
            className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
              task.completed 
                ? 'bg-blue-600 border-blue-600 text-white' 
                : 'border-slate-600 hover:border-blue-500'
            }`}
          >
            {task.completed && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold tracking-tight ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                {task.category}
              </span>
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
                className={`transition-colors ${
                  (task.rating || 0) >= star ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'
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

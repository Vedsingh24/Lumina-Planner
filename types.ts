export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  completed: boolean;
  rating: number | null; // 1-5 scale
  createdAt: string;
  completedAt?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  isRecurring?: boolean;
  recurringSourceId?: string; // Links a daily clone back to its recurring source
}

export interface DraggableImage {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Note {
  id: string;
  text: string;
  isCustomHtml?: boolean; // If it contains custom formatted text like bold/italic or images
  createdAt: string;
  date?: string; // YYYY-MM-DD
  images?: DraggableImage[];
}

export interface PlannerState {
  tasks: Task[];
  userName: string;
  dailyMission?: string;
  chatHistory: Record<string, ChatMessage[]>;
  notes?: Note[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
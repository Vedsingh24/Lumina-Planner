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
}

export interface PlannerState {
  tasks: Task[];
  userName: string;
  dailyMission?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
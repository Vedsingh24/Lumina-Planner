import { PlannerState, Task } from '../types.ts';

const STORAGE_KEY = 'lumina_planner_data';

export const storageService = {
  loadState: (): PlannerState => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        tasks: parsed.tasks || [],
        userName: parsed.userName || 'User',
        dailyMission: parsed.dailyMission || ''
      };
    }
    return {
      tasks: [],
      userName: 'User',
      dailyMission: ''
    };
  },

  saveState: (state: PlannerState): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  addTask: (task: Task): void => {
    const state = storageService.loadState();
    state.tasks.push(task);
    storageService.saveState(state);
  },

  updateTask: (taskId: string, updates: Partial<Task>): void => {
    const state = storageService.loadState();
    state.tasks = state.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    storageService.saveState(state);
  },

  deleteTask: (taskId: string): void => {
    const state = storageService.loadState();
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    storageService.saveState(state);
  },

  clearAll: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
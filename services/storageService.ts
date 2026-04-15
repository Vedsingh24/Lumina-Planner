import { PlannerState, Task } from '../types.ts';

const STORAGE_KEY = 'lumina_planner_data';

// Helper to detect if we're in Electron
function isElectron(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return !!(window as any).require && !!(window as any).require('electron')?.ipcRenderer;
  } catch (e) {
    return false;
  }
}

function getIpcRenderer(): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const electron = (window as any).require?.('electron');
    return electron?.ipcRenderer || null;
  } catch (e) {
    return null;
  }
}

export const storageService = {
  // Load state: merges all historical data from all dates
  loadState: (): PlannerState => {
    const ipc = getIpcRenderer();
    console.log('📂 loadState called, IPC available:', !!ipc);

    // Try IPC first
    if (ipc) {
      try {
        console.log('  Calling sendSync(storage-load-sync)...');
        const res = (ipc as any).sendSync('storage-load-sync');
        console.log('  Raw result from IPC:', res);

        if (res) {
          return {
            tasks: res.tasks || [],
            userName: res.userName || 'User',
            dailyMission: res.dailyMission || '',
            chatHistory: res.chatHistory || {},
            notes: res.notes || []
          };
        }
      } catch (e) {
        console.error('  ✗ IPC sendSync failed:', e);
      }
    }

    // Fallback to localStorage
    console.log('  Using localStorage fallback');
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        tasks: parsed.tasks || [],
        userName: parsed.userName || 'User',
        dailyMission: parsed.dailyMission || '',
        chatHistory: parsed.chatHistory || {},
        notes: parsed.notes || []
      };
    }
    return {
      tasks: [],
      userName: 'User',
      dailyMission: '',
      chatHistory: {},
      notes: []
    };
  },

  // Save state: writes to BOTH IPC and localStorage for maximum persistence
  saveState: async (state: PlannerState): Promise<void> => {
    // ✅ Always write to localStorage as non-volatile fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }

    const ipc = getIpcRenderer();
    if (ipc) {
      try {
        await (ipc as any).invoke('storage-save', state);
        return;
      } catch (e) {
        console.error('IPC save failed (localStorage backup used):', e);
      }
    }
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
    const ipc = getIpcRenderer();
    if (ipc) {
      try {
        (ipc as any).invoke('storage-clear').catch(() => {
          localStorage.removeItem(STORAGE_KEY);
        });
        return;
      } catch (e) {
        // fall through
      }
    }
    localStorage.removeItem(STORAGE_KEY);
  }
};
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
        
        if (res && Array.isArray(res.tasks)) {
          console.log('  ✓ Loaded', res.tasks.length, 'total tasks from all dates');
          return res as PlannerState;
        } else if (res) {
          console.log('  ✓ Loaded state:', res);
          return res as PlannerState;
        } else {
          console.log('  ✗ IPC returned null, falling back to localStorage');
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
        dailyMission: parsed.dailyMission || ''
      };
    }
    return {
      tasks: [],
      userName: 'User',
      dailyMission: ''
    };
  },

  // Save state: appends/updates today's entry and prunes old data
  saveState: async (state: PlannerState): Promise<void> => {
    const ipc = getIpcRenderer();
    console.log('💾 saveState called, IPC available:', !!ipc);
    console.log('  Tasks to save:', state.tasks?.length || 0);
    
    if (ipc) {
      try {
        console.log('  Calling invoke(storage-save)...');
        const result = await (ipc as any).invoke('storage-save', state);
        console.log('  Save result:', result);
        return;
      } catch (e) {
        console.error('  ✗ IPC save failed:', e);
      }
    }
    
    // Fallback to localStorage
    console.log('  Using localStorage fallback');
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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storageService } from '../../services/storageService';

// Mock electron requiring
vi.mock('electron', () => ({
    ipcRenderer: {
        sendSync: vi.fn(),
        invoke: vi.fn(),
    },
}));

describe('storageService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it('should return default state if no storage exists', () => {
        const state = storageService.loadState();
        expect(state).toEqual({
            tasks: [],
            userName: 'User',
            dailyMission: '',
            chatHistory: {},
        });
    });

    it('should load from localStorage if Electron is not available', () => {
        const mockState = {
            tasks: [{ id: '1', title: 'Test Task' }],
            userName: 'Tester',
            dailyMission: 'Win',
            chatHistory: {}
        };
        localStorage.setItem('lumina_planner_data', JSON.stringify(mockState));

        const state = storageService.loadState();
        expect(state.userName).toBe('Tester');
        expect(state.tasks).toHaveLength(1);
    });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from '../../components/TaskCard';
import { Task } from '../../types';

describe('TaskCard Component', () => {
    const mockTask: Task = {
        id: 'test-1',
        title: 'Buy Milk',
        description: '2% Fat',
        category: 'Personal',
        priority: 'high',
        completed: false,
        date: '2024-02-03',
        createdAt: '2024-02-03T00:00:00.000Z',
        rating: null
    };

    const mockHandlers = {
        onToggle: vi.fn(),
        onRate: vi.fn(),
        onDelete: vi.fn(),
        onUpdate: vi.fn(),
        activeDropdown: null,
        onSetActiveDropdown: vi.fn()
    };

    it('renders task details correctly', () => {
        render(<TaskCard task={mockTask} {...mockHandlers} />);

        expect(screen.getByText('Buy Milk')).toBeInTheDocument();
        expect(screen.getByText('2% Fat')).toBeInTheDocument();
        expect(screen.getByText('high')).toHaveClass('text-red-400'); // Check priority color
    });

    it('calls onToggle when checkbox is clicked', () => {
        render(<TaskCard task={mockTask} {...mockHandlers} />);

        const toggleBtn = screen.getByRole('button', { name: '' }); // The first button is usually toggle
        // However, since we have multiple buttons, it's safer to find by selector or testid if added.
        // For now, let's rely on the svg presence or order. The first button in code is toggle.
        // Better strategy: Add aria-label to buttons in source code for better testing. 
        // But for this example, let's just click the button that wraps the check icon logic.

        // Actually, let's just trigger the first button found
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);

        expect(mockHandlers.onToggle).toHaveBeenCalledWith('test-1');
    });

    it('calls onDelete when trash icon is clicked', () => {
        render(<TaskCard task={mockTask} {...mockHandlers} />);

        // The delete button is the last button in the main row
        const deleteBtn = screen.getAllByRole('button')[1];
        fireEvent.click(deleteBtn);

        expect(mockHandlers.onDelete).toHaveBeenCalledWith('test-1');
    });
});

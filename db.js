const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let db;

/**
 * Initialize the database and run migrations
 * @param {string} userDataPath - The path to the user data directory
 * @returns {void}
 */
function initDB(userDataPath) {
    const dbPath = path.join(userDataPath, 'lumina.db');
    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      category TEXT,
      priority TEXT,
      completed INTEGER,
      rating INTEGER,
      createdAt TEXT,
      completedAt TEXT,
      date TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      role TEXT,
      content TEXT,
      timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      date TEXT,
      text TEXT,
      images TEXT,
      createdAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
  `);

    // Check for legacy JSON data and migrate if needed
    migrateFromJSON(userDataPath);
}

/**
 * Migrate data from lumina_data.json if it exists and DB is empty
 */
function migrateFromJSON(userDataPath) {
    const jsonPath = path.join(userDataPath, 'lumina_data.json');

    // Only migrate if JSON exists
    if (!fs.existsSync(jsonPath)) return;

    // Check if DB is already populated (to avoid double migration)
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    if (taskCount.count > 0) return;

    console.log('Migrating from JSON to SQLite...');

    try {
        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(rawData);

        // 1. Migrate Tasks
        if (data.tasks && Array.isArray(data.tasks)) {
            const insertTask = db.prepare(`
        INSERT OR REPLACE INTO tasks (id, title, description, category, priority, completed, rating, createdAt, completedAt, date)
        VALUES (@id, @title, @description, @category, @priority, @completed, @rating, @createdAt, @completedAt, @date)
      `);

            const insertMany = db.transaction((tasks) => {
                for (const task of tasks) {
                    insertTask.run({
                        id: task.id,
                        title: task.title || '',
                        description: task.description || '',
                        category: task.category || 'General',
                        priority: task.priority || 'medium',
                        completed: task.completed ? 1 : 0,
                        rating: task.rating || null,
                        createdAt: task.createdAt || new Date().toISOString(),
                        completedAt: task.completedAt || null,
                        date: task.date || new Date().toISOString().split('T')[0]
                    });
                }
            });

            insertMany(data.tasks);
        }

        // 2. Migrate Settings (userName, dailyMission)
        const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        if (data.userName) insertSetting.run('userName', data.userName);
        if (data.dailyMission) insertSetting.run('dailyMission', data.dailyMission);

        // 3. Migrate Chat History
        if (data.chatHistory) {
            const insertChat = db.prepare(`
        INSERT INTO chat_history (date, role, content, timestamp)
        VALUES (@date, @role, @content, @timestamp)
      `);

            const insertChats = db.transaction((history) => {
                for (const [date, messages] of Object.entries(history)) {
                    for (const msg of messages) {
                        insertChat.run({
                            date: date,
                            role: msg.role,
                            content: msg.content,
                            timestamp: msg.timestamp || new Date().toISOString()
                        });
                    }
                }
            });

            insertChats(data.chatHistory);
        }

        console.log('Migration successful. Renaming old JSON file.');
        fs.renameSync(jsonPath, jsonPath + '.bak');

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

/**
 * Load the entire application state from the database
 * @returns {object} PlannerState
 */
function loadState() {
    if (!db) return null;

    try {
        // Load Settings
        const settings = db.prepare('SELECT key, value FROM settings').all();
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        // Load Tasks
        const tasks = db.prepare('SELECT * FROM tasks').all().map(t => ({
            ...t,
            completed: !!t.completed // Convert 0/1 to boolean
        }));

        // Load Chat History
        const chats = db.prepare('SELECT date, role, content, timestamp FROM chat_history ORDER BY timestamp ASC').all();
        const chatHistory = chats.reduce((acc, curr) => {
            if (!acc[curr.date]) acc[curr.date] = [];
            acc[curr.date].push({
                role: curr.role,
                content: curr.content,
                timestamp: curr.timestamp
            });
            return acc;
        }, {});

        return {
            tasks: tasks || [],
            userName: settingsMap.userName || 'User',
            dailyMission: settingsMap.dailyMission || '',
            chatHistory: chatHistory || {},
            notes: (db.prepare('SELECT * FROM notes').all() || []).map(n => ({
                ...n,
                images: JSON.parse(n.images || '[]')
            }))
        };
    } catch (error) {
        console.error('Error loading state from DB:', error);
        return null;
    }
}

/**
 * Save the application state to the database
 * @param {object} state - PlannerState
 */
function saveState(state) {
    if (!db) return;

    try {
        // Transaction for atomic updates
        const saveTransaction = db.transaction(() => {
            // 1. Save Settings
            const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            insertSetting.run('userName', state.userName);
            insertSetting.run('dailyMission', state.dailyMission || '');

            // 2. Save Tasks (Upsert)
            // Note: For a "pure" sync from a monolithic state, we might ideally diff or clear & rewrite. 
            // But clearing & rewriting is safer for "exact" state mirroring if deletion happens on frontend.
            // However, to be more efficient, we'll assume the frontend sends the *latest* list.
            // The safest "monolith" approach for SQL is usually:
            // A) Delete all and re-insert (easiest, but heavy WAL usage)
            // B) Upsert all, and delete IDs not in the list (better)

            // Let's go with B for robustness.
            const existingIds = db.prepare('SELECT id FROM tasks').all().map(t => t.id);
            const newIds = new Set(state.tasks.map(t => t.id));

            // Delete removed tasks
            const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ?');
            existingIds.forEach(id => {
                if (!newIds.has(id)) deleteStmt.run(id);
            });

            // Upsert current tasks
            const upsertTask = db.prepare(`
        INSERT OR REPLACE INTO tasks (id, title, description, category, priority, completed, rating, createdAt, completedAt, date)
        VALUES (@id, @title, @description, @category, @priority, @completed, @rating, @createdAt, @completedAt, @date)
      `);

            for (const task of state.tasks) {
                upsertTask.run({
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    category: task.category,
                    priority: task.priority,
                    completed: task.completed ? 1 : 0,
                    rating: task.rating,
                    createdAt: task.createdAt,
                    completedAt: task.completedAt,
                    date: task.date
                });
            }

            // 3. Save Chat History
            // Chat is append-only usually, but for exact syncing we should also handle it carefully.
            // Deleting all chat history processing every save is EXPENSIVE. 
            // Optimization: Only insert *new* messages?
            // Given the user wants "persistence" guarantees, let's play it safe but maybe optimize later.
            // For now, doing a DELETE ALL + RE-INSERT for chat is heavy if history is long.
            // BETTER: Insert ignore or checks? 
            // Let's assume chat doesn't change *past* messages often. 
            // A simple approach for this "MVP" migration is to stick to the robust method: Clear & Rewrite.
            // SQLite is fast enough for localized data sets of this size (< 10k rows usually).

            db.prepare('DELETE FROM chat_history').run(); // Wipe for clean sync (simplest persistence guarantee)

            const insertChat = db.prepare(`
        INSERT INTO chat_history (date, role, content, timestamp)
        VALUES (@date, @role, @content, @timestamp)
      `);

            for (const [date, messages] of Object.entries(state.chatHistory)) {
                for (const msg of messages) {
                    insertChat.run({
                        date: date,
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.timestamp
                    });
                }
            }

            // 4. Save Notes
            const existingNoteIds = db.prepare('SELECT id FROM notes').all().map(n => n.id);
            const newNoteIds = new Set((state.notes || []).map(n => n.id));

            // Delete removed notes
            const deleteNoteStmt = db.prepare('DELETE FROM notes WHERE id = ?');
            existingNoteIds.forEach(id => {
                if (!newNoteIds.has(id)) deleteNoteStmt.run(id);
            });

            // Upsert current notes
            const upsertNote = db.prepare(`
                INSERT OR REPLACE INTO notes (id, date, text, images, createdAt)
                VALUES (@id, @date, @text, @images, @createdAt)
            `);

            for (const note of (state.notes || [])) {
                upsertNote.run({
                    id: note.id,
                    date: note.date,
                    text: note.text,
                    images: JSON.stringify(note.images || []),
                    createdAt: note.createdAt
                });
            }
        });

        saveTransaction();
        console.log('State saved to SQLite successfully.');
        return true;

    } catch (error) {
        console.error('Error saving state to DB:', error);
        throw error;
    }
}

module.exports = { initDB, loadState, saveState };

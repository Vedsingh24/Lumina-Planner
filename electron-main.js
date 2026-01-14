const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Set app name for proper userData path
app.name = 'Lumina Planner';

// Detect dev mode by checking if dist folder exists
const isDev = !require('fs').existsSync(path.join(__dirname, 'dist'));

const DATA_FILE = path.join(app.getPath('userData'), 'lumina_data.json');

async function readDataFile() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    console.log('✓ Data file read successfully from:', DATA_FILE);
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.log('  Converting old format to new array format');
      return [data];
    }
    return data;
  } catch (e) {
    console.log('✗ No existing data file found at:', DATA_FILE);
    return [];
  }
}

async function writeDataFile(dailyEntries) {
  try {
    // No pruning - keep all historical data permanently (append-only)
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(dailyEntries, null, 2), 'utf8');
    console.log('✓ Data saved successfully to:', DATA_FILE);
    console.log('  Total entries preserved:', dailyEntries.length);
    return true;
  } catch (e) {
    console.error('✗ Failed to write data file:', e);
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Hide the menu bar
  win.removeMenu();

  const url = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, 'dist', 'index.html')}`;
  
  win.loadURL(url);

  // Show window in fullscreen
  win.once('ready-to-show', () => {
    win.show();
  });

  return win;
}

app.whenReady().then(() => {
  console.log('🚀 App ready, setting up IPC handlers...');
  console.log('📁 Data file location:', DATA_FILE);
  
  // IPC Handlers for storage
  ipcMain.handle('storage-save', async (event, state) => {
    console.log('💾 IPC: storage-save called (append-only mode)');
    const allEntries = await readDataFile();
    
    const today = new Date().toISOString().split('T')[0];
    const todayIndex = allEntries.findIndex(e => e.date === today);
    
    const todayEntry = {
      date: today,
      tasks: state.tasks,
      dailyMission: state.dailyMission,
      userName: state.userName,
      timestamp: new Date().toISOString()
    };
    
    if (todayIndex < 0) {
      // Add new entry for today
      allEntries.unshift(todayEntry);
      console.log('  ✓ New daily entry created');
    } else {
      // Update today's entry (same day, still appending)
      allEntries[todayIndex] = todayEntry;
      console.log('  ✓ Today\'s entry updated and saved');
    }
    
    const ok = await writeDataFile(allEntries);
    return { ok };
  });

  ipcMain.handle('storage-load', async () => {
    console.log('📂 IPC: storage-load called');
    const allEntries = await readDataFile();
    
    // Merge all tasks from all dates
    const mergedState = {
      tasks: [],
      userName: 'User',
      dailyMission: ''
    };
    
    // Iterate from newest to oldest
    for (const entry of allEntries) {
      if (!mergedState.dailyMission && entry.dailyMission) {
        mergedState.dailyMission = entry.dailyMission;
      }
      if (entry.tasks && Array.isArray(entry.tasks)) {
        mergedState.tasks.push(...entry.tasks);
      }
    }
    
    console.log('  Total entries in history:', allEntries.length);
    console.log('  Merged tasks:', mergedState.tasks.length);
    return mergedState;
  });

  // Synchronous load for initial startup
  ipcMain.on('storage-load-sync', async (event) => {
    console.log('📂 IPC: storage-load-sync called');
    const allEntries = await readDataFile();
    
    // Merge all tasks from all dates
    const mergedState = {
      tasks: [],
      userName: 'User',
      dailyMission: ''
    };
    
    for (const entry of allEntries) {
      if (!mergedState.dailyMission && entry.dailyMission) {
        mergedState.dailyMission = entry.dailyMission;
      }
      if (entry.tasks && Array.isArray(entry.tasks)) {
        mergedState.tasks.push(...entry.tasks);
      }
    }
    
    console.log('  Returning:', allEntries.length, 'date entries with', mergedState.tasks.length, 'total tasks');
    event.returnValue = mergedState;
  });

  ipcMain.handle('storage-clear', async () => {
    try {
      await fs.unlink(DATA_FILE);
      console.log('🗑️  Data cleared');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.on('quit-app', () => {
    console.log('❌ Quit signal received, closing app');
    app.quit();
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});


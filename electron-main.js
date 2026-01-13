const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Detect dev mode by checking if dist folder exists
const isDev = !require('fs').existsSync(path.join(__dirname, 'dist'));

const DATA_FILE = path.join(app.getPath('userData'), 'lumina_data.json');

async function readDataFile() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.log('No existing data file, returning null');
    return null;
  }
}

async function writeDataFile(obj) {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
    console.log('Data saved to:', DATA_FILE);
    return true;
  } catch (e) {
    console.error('Failed to write data file:', e);
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
  // IPC Handlers for storage
  ipcMain.handle('storage-save', async (event, state) => {
    const ok = await writeDataFile(state);
    return { ok };
  });

  ipcMain.handle('storage-load', async () => {
    const data = await readDataFile();
    return data;
  });

  // Synchronous load for initial startup
  ipcMain.on('storage-load-sync', async (event) => {
    const data = await readDataFile();
    event.returnValue = data;
  });

  ipcMain.handle('storage-clear', async () => {
    try {
      await fs.unlink(DATA_FILE);
      console.log('Data cleared');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.on('quit-app', () => {
    console.log('Quit signal received, closing app');
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


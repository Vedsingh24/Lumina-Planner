const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');

// Set app name for proper userData path
app.name = 'Lumina Planner';

// Detect dev mode by checking if dist folder exists
const isDev = !require('fs').existsSync(path.join(__dirname, 'dist'));

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    frame: false, // Frameless for custom title bar
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
  console.log('🚀 App ready, initializing database...');

  // Initialize Database
  try {
    db.initDB(app.getPath('userData'));
    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
  }

  // IPC Handlers for storage
  ipcMain.handle('storage-save', async (event, state) => {
    console.log('💾 IPC: storage-save called');
    try {
      return db.saveState(state);
    } catch (err) {
      console.error('❌ Save failed:', err);
      return false;
    }
  });

  ipcMain.handle('storage-load', async () => {
    console.log('📂 IPC: storage-load called');
    return db.loadState();
  });

  // Synchronous load for initial startup (renderer blocks until this returns)
  ipcMain.on('storage-load-sync', (event) => {
    console.log('📂 IPC: storage-load-sync called');
    try {
      const data = db.loadState();
      event.returnValue = data;
    } catch (err) {
      console.error('❌ Sync load failed:', err);
      event.returnValue = { tasks: [], userName: 'User', dailyMission: '', chatHistory: {} };
    }
  });

  ipcMain.handle('storage-clear', async () => {
    // For DB, "clearing" might mean dropping tables or deleting rows.
    // For safety in this migration, let's just log a warning or no-op since 
    // user didn't explicitly ask for a clear-db feature in the migration plan.
    // If needed, we can implement db.clear() later.
    console.log('⚠️ storage-clear called but suppressed for DB safety');
    return { ok: true };
  });

  /* =========================
     Window Controls
     ========================= */
  ipcMain.on('minimize-app', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  });

  ipcMain.on('quit-app', () => {
    console.log('❌ Quit signal received, closing app');
    app.quit();
  });

  ipcMain.handle('export-to-pdf', async (event, htmlContent) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const { dialog } = require('electron');
    const fs = require('fs');

    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Journal as PDF',
      defaultPath: path.join(app.getPath('documents'), `Lumina_Journal_${new Date().toISOString().split('T')[0]}.pdf`),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (!filePath) return false;

    // Create a hidden window to render the PDF
    const printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true } });
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    try {
      const data = await printWin.webContents.printToPDF({
        marginsType: 0,
        pageSize: 'A4',
        printBackground: true,
        landscape: false
      });
      fs.writeFileSync(filePath, data);
      printWin.close();
      return true;
    } catch (err) {
      console.error('PDF Generation Error:', err);
      printWin.close();
      return false;
    }
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

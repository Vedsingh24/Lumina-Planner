const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable security warnings for local development
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

function loadEnv() {
  // Check both the app directory and the directory containing the executable
  const pathsToSearch = [
    path.join(__dirname, '.env.local'),
    path.join(path.dirname(app.getPath('exe')), '.env.local'),
    path.join(process.cwd(), '.env.local')
  ];

  for (const envPath of pathsToSearch) {
    if (fs.existsSync(envPath)) {
      try {
        const envFile = fs.readFileSync(envPath, 'utf8');
        const lines = envFile.split(/\r?\n/);
        lines.forEach(line => {
          const [key, ...valueParts] = line.split('=');
          if (key && key.trim() === 'GEMINI_API_KEY') {
            const value = valueParts.join('=').trim();
            process.env.API_KEY = value;
            console.log(`[SUCCESS] API_KEY loaded from: ${envPath}`);
          }
        });
        if (process.env.API_KEY) break;
      } catch (err) {
        console.error(`Error reading ${envPath}:`, err);
      }
    }
  }
}

function createWindow() {
  loadEnv();

  if (!process.env.API_KEY) {
    console.error('[CRITICAL] API_KEY is missing! Ensure .env.local exists with API_KEY=your_key');
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    fullscreen: true,
    backgroundColor: '#020617',
    title: 'Lumina Planner',
    icon: path.join(__dirname, 'icon.png'), // Add an icon.png to your folder if you have one
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    }
  });

  // Load from Vite dev server in development, or from built files in production
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    // Set to development mode so env vars are injected
    process.env.NODE_ENV = 'development';
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile('index.html');
  }
  win.setMenuBarVisibility(false);
}

// Handle quit message from renderer process
ipcMain.on('quit-app', () => {
  app.quit();
});

// Handle PDF export silently
ipcMain.handle('export-to-pdf', async (event, htmlContent) => {
  let printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // Give it a tiny moment to parse fonts
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' }
    });

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save PDF',
      defaultPath: path.join(app.getPath('documents'), 'Lumina_Journal_Export.pdf'),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) {
      printWin.close();
      return false;
    }

    fs.writeFileSync(filePath, pdfBuffer);
    printWin.close();
    return true;
  } catch (error) {
    console.error('PDF Export Error:', error);
    if (printWin && !printWin.isDestroyed()) printWin.close();
    return false;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
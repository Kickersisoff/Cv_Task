const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const WebSocket = require('ws');

let mainWindow;
let ws;

// Function to create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the index.html file into the window
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  ws = new WebSocket('ws://localhost:8080/ws');

  ws.on('open', () => {
    console.log('WebSocket connection established');
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  mainWindow.on('closed', function () {
    if (ws) {
      ws.close();
    }
    mainWindow = null;
  });
}

app.on('ready', createWindow);

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

// to handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
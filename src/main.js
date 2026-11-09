const path = require('node:path');
const { app, BrowserWindow, desktopCapturer, ipcMain, safeStorage, screen, session, shell } = require('electron');
const { Coach } = require('./coach');
const { ensureContexts, listClients, readContext } = require('./contexts');
const { createStreamer } = require('./llm');
const { buildSystem } = require('./prompt');
const { SettingsStore, missingSetup } = require('./settings');
const { SttStream } = require('./stt');

const BAR_WIDTH = 880;
const BAR_HEIGHT = 128;
const preload = path.join(__dirname, 'preload.js');
const page = (name) => path.join(__dirname, '..', 'renderer', name);

let bar;
let settingsWindow;
let streams = {};
let coach;
let store;
let contextsRoot;

const sendToBar = (channel, payload) => bar && !bar.isDestroyed() && bar.webContents.send(channel, payload);

function createBar() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  bar = new BrowserWindow({
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    x: Math.round((width - BAR_WIDTH) / 2),
    y: 8,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false },
  });
  bar.setAlwaysOnTop(true, 'screen-saver');
  bar.loadFile(page('bar.html'));
  bar.on('closed', () => {
    stopCall();
    app.quit();
  });
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow.focus();
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 720,
    title: 'Coach',
    autoHideMenuBar: true,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false },
  });
  settingsWindow.loadFile(page('settings.html'));
}

function startCall(client) {
  const settings = store.load();
  const missing = missingSetup(settings);
  if (missing) return { error: missing };

  stopCall();
  coach = new Coach({ stream: createStreamer(settings), system: buildSystem(readContext(contextsRoot, client)) });
  coach.on('first', (info) => sendToBar('coach:first', info));
  coach.on('text', (text) => sendToBar('coach:text', text));
  coach.on('error', (err) => sendToBar('coach:error', err.message));

  const options = {
    apiKey: settings.elevenlabsKey,
    language: settings.language,
    onError: (message) => sendToBar('coach:error', message),
    onTranscript: (event) => {
      if (coach) coach.onTranscript(event);
      if (event.source === 'them') sendToBar('coach:heard', event.text);
    },
  };
  streams = {
    them: new SttStream({ ...options, source: 'them' }),
    me: new SttStream({ ...options, source: 'me' }),
  };
  return { ok: true };
}

function stopCall() {
  Object.values(streams).forEach((stream) => stream.close());
  streams = {};
  if (coach) coach.stop();
  coach = null;
}

function registerIpc() {
  ipcMain.handle('call:start', (_e, client) => startCall(client));
  ipcMain.handle('call:stop', () => stopCall());
  ipcMain.on('call:audio', (_e, source, pcm) => streams[source]?.send(pcm));
  ipcMain.handle('clients:list', () => listClients(contextsRoot));
  ipcMain.handle('settings:get', () => store.publicView());
  ipcMain.handle('settings:save', (_e, changes) => {
    store.save(changes);
    return store.publicView();
  });
  ipcMain.handle('settings:open', () => openSettings());
  ipcMain.handle('contexts:open', () => shell.openPath(contextsRoot));
  ipcMain.handle('app:quit', () => app.quit());
}

app.whenReady().then(() => {
  store = new SettingsStore({ file: path.join(app.getPath('userData'), 'settings.json'), crypto: safeStorage });
  contextsRoot = path.join(app.getPath('documents'), 'Coach');
  ensureContexts(contextsRoot);

  // Windows hands over everything the computer is playing, which includes the call.
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const [source] = await desktopCapturer.getSources({ types: ['screen'] });
    callback({ video: source, audio: 'loopback' });
  });

  registerIpc();
  createBar();
});

app.on('window-all-closed', () => app.quit());

const { contextBridge, ipcRenderer } = require('electron');

const listen = (channel) => (callback) => ipcRenderer.on(channel, (_e, payload) => callback(payload));

contextBridge.exposeInMainWorld('coach', {
  start: (client) => ipcRenderer.invoke('call:start', client),
  stop: () => ipcRenderer.invoke('call:stop'),
  sendAudio: (source, pcm) => ipcRenderer.send('call:audio', source, pcm),
  listClients: () => ipcRenderer.invoke('clients:list'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (changes) => ipcRenderer.invoke('settings:save', changes),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  openContexts: () => ipcRenderer.invoke('contexts:open'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onFirst: listen('coach:first'),
  onText: listen('coach:text'),
  onHeard: listen('coach:heard'),
  onError: listen('coach:error'),
});

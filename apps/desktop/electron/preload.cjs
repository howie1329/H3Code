const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('h3code', {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings)
  }
});

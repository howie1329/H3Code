const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('h3code', {
  platform: process.platform,
  metadata: {
    get: () => ipcRenderer.invoke('metadata:get')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings)
  }
});

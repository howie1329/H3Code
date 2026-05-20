const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('h3code', {
  platform: process.platform,
  metadata: {
    get: () => ipcRenderer.invoke('metadata:get')
  },
  repos: {
    list: () => ipcRenderer.invoke('repos:list'),
    add: (input) => ipcRenderer.invoke('repos:add', input),
    select: (input) => ipcRenderer.invoke('repos:select', input)
  },
  dialog: {
    pickRepositoryDirectory: () => ipcRenderer.invoke('dialog:pickRepositoryDirectory')
  },
  sessions: {
    list: (input) => ipcRenderer.invoke('sessions:list', input),
    create: (input) => ipcRenderer.invoke('sessions:create', input),
    select: (input) => ipcRenderer.invoke('sessions:select', input),
    getMessages: (input) => ipcRenderer.invoke('sessions:getMessages', input),
    updateTitle: (input) => ipcRenderer.invoke('sessions:updateTitle', input),
    sendMessage: (input) => ipcRenderer.invoke('sessions:sendMessage', input),
    onTranscriptEvent: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('sessions:transcriptEvent', listener);
      return () => ipcRenderer.removeListener('sessions:transcriptEvent', listener);
    },
    onSessionUpdated: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('sessions:updated', listener);
      return () => ipcRenderer.removeListener('sessions:updated', listener);
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings),
    detectPiExecutable: () => ipcRenderer.invoke('settings:detectPiExecutable')
  },
  files: {
    resolveMentions: (input) => ipcRenderer.invoke('files:resolveMentions', input)
  },
  pi: {
    stopSession: (input) => ipcRenderer.invoke('pi:stopSession', input)
  }
});

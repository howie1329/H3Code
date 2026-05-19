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
    getMessages: (input) => ipcRenderer.invoke('sessions:getMessages', input),
    sendMessage: (input) => ipcRenderer.invoke('sessions:sendMessage', input)
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

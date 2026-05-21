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
    createDraft: (input) => ipcRenderer.invoke('sessions:createDraft', input),
    select: (input) => ipcRenderer.invoke('sessions:select', input),
    getLocalMessages: (input) => ipcRenderer.invoke('sessions:getLocalMessages', input),
    getMessages: (input) => ipcRenderer.invoke('sessions:getMessages', input),
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
    },
    onMessagesUpdated: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('sessions:messagesUpdated', listener);
      return () => ipcRenderer.removeListener('sessions:messagesUpdated', listener);
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings),
    detectPiExecutable: () => ipcRenderer.invoke('settings:detectPiExecutable')
  },
  pi: {
    stop: () => ipcRenderer.invoke('pi:stop')
  }
});

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('h3code', {
  platform: process.platform
});

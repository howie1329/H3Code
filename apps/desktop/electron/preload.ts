import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("h3code", {
  selectRepository: () => ipcRenderer.invoke("repository:select"),
});

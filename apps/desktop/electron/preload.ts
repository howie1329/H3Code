import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("h3code", {
  platform: process.platform,
});

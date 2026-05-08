const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arabicManager', {
  getStatus: () => ipcRenderer.invoke('manager:getStatus'),
  build: () => ipcRenderer.invoke('manager:build'),
  install: () => ipcRenderer.invoke('manager:install'),
  buildAndInstall: () => ipcRenderer.invoke('manager:buildAndInstall'),
  restore: () => ipcRenderer.invoke('manager:restore'),
  chooseGameFolder: () => ipcRenderer.invoke('manager:chooseGameFolder'),
  openPath: (key) => ipcRenderer.invoke('manager:openPath', key),
  onLog: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('manager-log', listener);
    return () => ipcRenderer.removeListener('manager-log', listener);
  }
});

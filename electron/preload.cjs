const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('neuralForge', {
  platform: process.platform,
  getCaptureSources: () => ipcRenderer.invoke('capture:sources'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:always-on-top', Boolean(value)),
  saveProject: (payload) => ipcRenderer.invoke('project:save', payload),
  loadProject: () => ipcRenderer.invoke('project:load'),
  getAppVersion: () => ipcRenderer.invoke('updates:version'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('updates:progress', listener);
    return () => ipcRenderer.removeListener('updates:progress', listener);
  },
});

const { app, BrowserWindow, desktopCapturer, dialog, ipcMain } = require('electron');
const crypto = require('node:crypto');
const https = require('node:https');
const { spawn } = require('node:child_process');
const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

let mainWindow;
const UPDATE_MANIFEST_URL = 'https://its-ze.github.io/neural-forge/update.json';
const UPDATE_ORIGIN = 'https://its-ze.github.io';
let availableUpdate = null;

function compareVersions(left, right) {
  const a = String(left).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const b = String(right).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
}

function trustedUpdateUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== UPDATE_ORIGIN || !url.pathname.startsWith('/neural-forge/')) {
    throw new Error('The update server returned an untrusted download address.');
  }
  return url;
}

function request(url, onResponse, redirects = 0) {
  return https.get(url, { headers: { 'User-Agent': `Neural-Forge/${app.getVersion()}`, 'Cache-Control': 'no-cache' } }, (response) => {
    if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      response.resume();
      if (redirects >= 5) return onResponse(new Error('The update server redirected too many times.'));
      const next = trustedUpdateUrl(new URL(response.headers.location, url).toString());
      request(next, onResponse, redirects + 1);
      return;
    }
    if (response.statusCode !== 200) {
      response.resume();
      return onResponse(new Error(`The update server returned HTTP ${response.statusCode || 'unknown'}.`));
    }
    onResponse(null, response);
  }).on('error', (error) => onResponse(error));
}

function readJson(url) {
  return new Promise((resolve, reject) => request(url, (error, response) => {
    if (error || !response) return reject(error || new Error('No response from update server.'));
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('The update server returned an invalid manifest.')); }
    });
    response.on('error', reject);
  }));
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();
  const manifestUrl = new URL(UPDATE_MANIFEST_URL);
  manifestUrl.searchParams.set('t', Date.now().toString());
  const manifest = await readJson(manifestUrl);
  if (!manifest || !/^\d+\.\d+\.\d+$/.test(String(manifest.version)) || !/^[a-f\d]{64}$/i.test(String(manifest.sha256))) {
    throw new Error('The update manifest is missing a valid version or SHA-256 checksum.');
  }
  trustedUpdateUrl(manifest.url);
  const updateAvailable = compareVersions(manifest.version, currentVersion) > 0;
  availableUpdate = updateAvailable ? {
    version: String(manifest.version), url: String(manifest.url), sha256: String(manifest.sha256).toLowerCase(),
    size: Number(manifest.size) || 0, notes: String(manifest.notes || 'Improvements and fixes.'),
  } : null;
  return { currentVersion, updateAvailable, update: availableUpdate };
}

async function downloadAndInstallUpdate(event) {
  if (!availableUpdate) await checkForUpdates();
  if (!availableUpdate) return { started: false, reason: 'up-to-date' };
  const update = availableUpdate;
  const downloadUrl = trustedUpdateUrl(update.url);
  const updateDir = path.join(app.getPath('userData'), 'updates');
  await fs.mkdir(updateDir, { recursive: true });
  const installerPath = path.join(updateDir, `Neural-Forge-Setup-${update.version}.exe`);
  const partialPath = `${installerPath}.partial`;
  await fs.rm(partialPath, { force: true });

  await new Promise((resolve, reject) => request(downloadUrl, (requestError, response) => {
    if (requestError || !response) return reject(requestError || new Error('The installer could not be downloaded.'));
    const total = Number(response.headers['content-length']) || update.size || 0;
    let received = 0;
    const hash = crypto.createHash('sha256');
    const file = fsSync.createWriteStream(partialPath, { flags: 'w' });
    const fail = (error) => { file.destroy(); fsSync.rmSync(partialPath, { force: true }); reject(error); };
    response.on('data', (chunk) => {
      received += chunk.length;
      hash.update(chunk);
      event.sender.send('updates:progress', { received, total, percent: total ? Math.min(100, Math.round((received / total) * 100)) : 0 });
    });
    response.on('error', fail);
    file.on('error', fail);
    file.on('finish', async () => {
      try {
        const actualHash = hash.digest('hex').toLowerCase();
        if (actualHash !== update.sha256) throw new Error('Safety check failed: the downloaded installer checksum did not match.');
        await fs.rm(installerPath, { force: true });
        await fs.rename(partialPath, installerPath);
        resolve();
      } catch (error) { fail(error); }
    });
    response.pipe(file);
  }));

  const child = spawn(installerPath, ['/S'], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  setTimeout(() => app.quit(), 350);
  return { started: true, version: update.version };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#080b13',
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#080b13', symbolColor: '#8b94a7', height: 42,
    } : false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('capture:sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 640, height: 360 },
    fetchWindowIcons: true,
  });
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    displayId: source.display_id,
    thumbnail: source.thumbnail.toDataURL(),
    icon: source.appIcon?.toDataURL() || null,
  }));
});

ipcMain.handle('window:always-on-top', (_event, value) => {
  mainWindow?.setAlwaysOnTop(value, 'floating');
  return value;
});

ipcMain.handle('updates:version', () => app.getVersion());
ipcMain.handle('updates:check', () => checkForUpdates());
ipcMain.handle('updates:install', (event) => downloadAndInstallUpdate(event));

ipcMain.handle('project:save', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Neural Forge project',
    defaultPath: 'neural-forge-project.json',
    filters: [{ name: 'Neural Forge Project', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { canceled: false, path: result.filePath };
});

ipcMain.handle('project:load', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Neural Forge project',
    properties: ['openFile'],
    filters: [{ name: 'Neural Forge Project', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const raw = await fs.readFile(result.filePaths[0], 'utf8');
  return { canceled: false, path: result.filePaths[0], data: JSON.parse(raw) };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

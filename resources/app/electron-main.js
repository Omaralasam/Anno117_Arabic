const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

function hasWorkspaceFiles(folder) {
  return Boolean(
    folder &&
    (
      exists(path.join(folder, 'rda-work', 'patch_filedb_existing_slot.js')) ||
      exists(path.join(folder, 'rda-work', 'patch_filedb_existing_slot.py'))
    ) &&
    exists(path.join(folder, 'install_existing_slot_arabic.ps1'))
  );
}

function walkUpForWorkspace(start) {
  let current = path.resolve(start);
  while (current && current !== path.dirname(current)) {
    if (hasWorkspaceFiles(current)) return current;
    current = path.dirname(current);
  }
  return hasWorkspaceFiles(current) ? current : null;
}

function findWorkspace() {
  const configCandidates = [
    path.join(path.dirname(process.execPath), 'workspace-path.txt'),
    path.join(process.cwd(), 'workspace-path.txt'),
    path.join(__dirname, 'workspace-path.txt')
  ];

  for (const configPath of configCandidates) {
    if (!exists(configPath)) continue;
    const configured = fs.readFileSync(configPath, 'utf8').trim();
    if (hasWorkspaceFiles(configured)) return configured;
  }

  const candidates = [
    process.env.ANNO117_ARABIC_WORKSPACE,
    process.cwd(),
    __dirname,
    path.resolve(__dirname, '..'),
    path.dirname(process.execPath)
  ].filter(Boolean);

  for (const candidate of candidates) {
    const found = walkUpForWorkspace(candidate);
    if (found) return found;
  }

  return path.resolve(__dirname, '..');
}

const WORKSPACE = findWorkspace();

function readConfiguredPath(fileName) {
  const candidates = [
    path.join(path.dirname(process.execPath), fileName),
    path.join(process.cwd(), fileName),
    path.join(__dirname, fileName),
    path.join(WORKSPACE, fileName)
  ];
  for (const candidate of candidates) {
    if (!exists(candidate)) continue;
    const value = fs.readFileSync(candidate, 'utf8').trim();
    if (value) return value;
  }
  return null;
}

function parseSteamLibraries() {
  const steamRoots = [
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Steam')
  ];
  const libraries = [];

  for (const steamRoot of steamRoots) {
    const libraryFile = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
    if (!exists(libraryFile)) continue;
    libraries.push(steamRoot);

    const text = fs.readFileSync(libraryFile, 'utf8');
    for (const match of text.matchAll(/"path"\s+"([^"]+)"/g)) {
      const libraryPath = match[1].replace(/\\\\/g, '\\');
      if (libraryPath && !libraries.includes(libraryPath)) libraries.push(libraryPath);
    }
  }

  return libraries;
}

function findGameRoot() {
  const configured = process.env.ANNO117_GAME_ROOT || readConfiguredPath('game-path.txt');
  if (configured) return configured;

  const candidates = [
    ...parseSteamLibraries().map((library) => path.join(library, 'steamapps', 'common', 'Anno 117 - Pax Romana')),
    'D:\\SteamLibrary\\steamapps\\common\\Anno 117 - Pax Romana',
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Anno 117 - Pax Romana',
    'C:\\Program Files\\Ubisoft\\Ubisoft Game Launcher\\games\\Anno 117 - Pax Romana',
    'C:\\Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games\\Anno 117 - Pax Romana'
  ];

  for (const candidate of candidates) {
    if (exists(path.join(candidate, 'maindata'))) return candidate;
  }

  return candidates[0] || 'D:\\SteamLibrary\\steamapps\\common\\Anno 117 - Pax Romana';
}

const GAME_ROOT = findGameRoot();
const MAINDATA = process.env.ANNO117_GAME_MAINDATA || path.join(GAME_ROOT, 'maindata');
const PATHS = {
  buildMerged: path.join(WORKSPACE, 'rda-work', 'build_merged_existing_slot_rda.ps1'),
  generateDb: path.join(WORKSPACE, 'rda-work', 'generate-filedb-for-direct-arabic.ps1'),
  patchDb: path.join(WORKSPACE, 'rda-work', 'patch_filedb_existing_slot.js'),
  install: path.join(WORKSPACE, 'install_existing_slot_arabic.ps1'),
  restore: path.join(WORKSPACE, 'restore_existing_slot_arabic.ps1'),
  measure: path.join(WORKSPACE, 'rda-work', 'measure_translation_progress.ps1'),
  payloadXml: path.join(WORKSPACE, 'rda-work', 'anno117-direct-arabic', 'payload', 'data', 'base', 'config', 'gui', 'texts_english.xml'),
  directRda: path.join(WORKSPACE, 'rda-work', 'anno117-direct-arabic', 'data99.rda'),
  packageDir: path.join(WORKSPACE, 'rda-work', 'existing-slot-arabic'),
  packageRda: path.join(WORKSPACE, 'rda-work', 'existing-slot-arabic', 'file_browse_patterns.rda'),
  backups: path.join(WORKSPACE, 'backups', 'existing-slot-arabic'),
  latestBackup: path.join(WORKSPACE, 'backups', 'existing-slot-arabic', 'latest.txt'),
  report: path.join(__dirname, 'تقرير_الأداة_العربية.md')
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#0f1218',
    title: 'Anno 117 Arabic Manager',
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

if (process.argv.includes('--status-json')) {
  buildStatus()
    .then((status) => {
      console.log(JSON.stringify(status, null, 2));
      app.quit();
    })
    .catch((error) => {
      console.error(error.message || error);
      app.exit(1);
    });
} else {
  app.whenReady().then(createWindow);
}
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function exists(filePath) {
  try { return fs.existsSync(filePath); } catch { return false; }
}

function statInfo(filePath) {
  if (!exists(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    size: stat.size,
    modified: stat.mtime.toISOString()
  };
}

function getDbNames() {
  const fileDb = exists(path.join(MAINDATA, 'file_h.db')) ? 'file_h.db' : 'file.db';
  const checksumDb = exists(path.join(MAINDATA, 'checksum_h.db')) ? 'checksum_h.db' : 'checksum.db';
  return { fileDb, checksumDb };
}

function annoChecksum(buffer) {
  const stage1 = crypto.createHash('md5').update(buffer).digest('hex');
  return crypto
    .createHash('md5')
    .update(Buffer.from(`${stage1}\r\n5443083368c9be33b50e3fdb3a8fa287`, 'ascii'))
    .digest('hex');
}

function sha256(filePath) {
  if (!exists(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function verifyInstalledChecksum() {
  try {
    const { fileDb, checksumDb } = getDbNames();
    const fileDbPath = path.join(MAINDATA, fileDb);
    const checksumPath = path.join(MAINDATA, checksumDb);
    if (!exists(fileDbPath) || !exists(checksumPath)) {
      return { ok: false, message: 'ملفات الفهرس غير موجودة.' };
    }

    const expected = fs.readFileSync(checksumPath).toString('ascii').trim().toLowerCase();
    const actual = annoChecksum(fs.readFileSync(fileDbPath)).toLowerCase();
    return {
      ok: actual === expected,
      actual,
      expected,
      message: actual === expected ? 'الفهرس والـ checksum متطابقان.' : 'يوجد اختلاف بين file DB و checksum.'
    };
  } catch (error) {
    return { ok: false, message: String(error.message || error) };
  }
}

function measureTranslation() {
  if (!exists(PATHS.payloadXml)) return null;
  const lines = fs.readFileSync(PATHS.payloadXml, 'utf8').split(/\r?\n/);
  let total = 0;
  let arabic = 0;
  let latin = 0;
  const unique = new Set();
  const uniqueArabic = new Set();

  for (const line of lines) {
    const match = line.match(/^\s*<Text>(.*)<\/Text>\s*$/);
    if (!match) continue;
    const text = match[1].trim();
    if (!text) continue;
    total += 1;
    unique.add(text);
    if (/[\u0600-\u06FF]/.test(text)) {
      arabic += 1;
      uniqueArabic.add(text);
    }
    if (/[A-Za-z]/.test(text)) latin += 1;
  }

  return {
    total,
    arabic,
    latin,
    percent: total ? Number(((arabic / total) * 100).toFixed(2)) : 0,
    unique: unique.size,
    uniqueArabic: uniqueArabic.size,
    uniquePercent: unique.size ? Number(((uniqueArabic.size / unique.size) * 100).toFixed(2)) : 0
  };
}

function readLatestBackup() {
  if (!exists(PATHS.latestBackup)) return null;
  const folder = fs.readFileSync(PATHS.latestBackup, 'utf8').trim();
  if (!folder || !exists(folder)) return null;
  return { path: folder, ...statInfo(folder) };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || WORKSPACE,
      env: {
        ...process.env,
        ANNO117_ARABIC_WORKSPACE: WORKSPACE,
        ANNO117_GAME_ROOT: GAME_ROOT,
        ANNO117_GAME_MAINDATA: MAINDATA
      },
      windowsHide: true,
      shell: false
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      options.onData?.('out', text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      options.onData?.('err', text);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else reject(new Error((stderr || stdout || `${command} exited with code ${code}`).trim()));
    });
  });
}

async function powershell(scriptPath, onData) {
  return runProcess('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath
  ], { cwd: WORKSPACE, onData });
}

async function getRunningProcesses() {
  const script = "$names=@('Anno117','UbisoftConnect','upc'); $found=@(); foreach($n in $names){ if(Get-Process -Name $n -ErrorAction SilentlyContinue){ $found += $n }}; [Console]::Write(($found -join ','))";
  try {
    const result = await runProcess('powershell.exe', ['-NoProfile', '-Command', script], { cwd: WORKSPACE });
    return result.stdout.trim() ? result.stdout.trim().split(',') : [];
  } catch {
    return [];
  }
}

function validatePrerequisites() {
  const missing = [];
  for (const [label, filePath] of Object.entries({
    'سكريبت بناء الأرشيف': PATHS.buildMerged,
    'سكريبت بناء الفهرس': PATHS.generateDb,
    'سكريبت ربط الفهرس': PATHS.patchDb,
    'سكريبت التثبيت': PATHS.install,
    'سكريبت الاستعادة': PATHS.restore,
    'ملف الترجمة': PATHS.payloadXml
  })) {
    if (!exists(filePath)) missing.push(`${label}: ${filePath}`);
  }
  if (!exists(MAINDATA)) missing.push(`مجلد maindata: ${MAINDATA}`);
  return missing;
}

function emitLog(event, type, text) {
  event.sender.send('manager-log', { type, text });
}

async function runWorkflow(event, steps) {
  const started = new Date();
  emitLog(event, 'info', `بدء التنفيذ: ${started.toLocaleString('ar')}\n`);

  const missing = validatePrerequisites();
  if (missing.length) {
    throw new Error(`ملفات ناقصة:\n${missing.join('\n')}`);
  }

  const running = await getRunningProcesses();
  if (steps.includes('install') && running.length) {
    throw new Error(`أغلق اللعبة و Ubisoft Connect قبل التثبيت. العمليات المفتوحة: ${running.join(', ')}`);
  }

  const onData = (stream, text) => emitLog(event, stream === 'err' ? 'warn' : 'out', text);

  if (steps.includes('build')) {
    emitLog(event, 'step', '\n[1/3] بناء أرشيف file_browse_patterns المدمج...\n');
    await powershell(PATHS.buildMerged, onData);

    emitLog(event, 'step', '\n[2/3] توليد file.db و checksum.db من الحزمة...\n');
    await powershell(PATHS.generateDb, onData);

    emitLog(event, 'step', '\n[3/3] ربط الحزمة بفتحة الأرشيف الحالية في اللعبة...\n');
    delete require.cache[require.resolve(PATHS.patchDb)];
    const { patchExistingSlot } = require(PATHS.patchDb);
    const patchResult = patchExistingSlot({ workspace: WORKSPACE, maindata: MAINDATA });
    emitLog(event, 'out', `patched=${patchResult.patched} skipped=${patchResult.skipped}\n`);
    emitLog(event, 'out', `checksum=${patchResult.checksum}\n`);
  }

  if (steps.includes('install')) {
    emitLog(event, 'step', '\n[تثبيت] نسخ الحزمة إلى maindata مع إنشاء نسخة احتياطية...\n');
    await powershell(PATHS.install, onData);
  }

  if (steps.includes('restore')) {
    emitLog(event, 'step', '\n[استعادة] إرجاع آخر نسخة احتياطية...\n');
    await powershell(PATHS.restore, onData);
  }

  const status = await buildStatus();
  emitLog(event, 'success', `\nانتهى التنفيذ خلال ${Math.round((Date.now() - started.getTime()) / 1000)} ثانية.\n`);
  return status;
}

async function buildStatus() {
  const { fileDb, checksumDb } = getDbNames();
  const installedRda = path.join(MAINDATA, 'file_browse_patterns.rda');
  const packageHash = sha256(PATHS.packageRda);
  const installedHash = sha256(installedRda);

  const missing = validatePrerequisites();
  const running = await getRunningProcesses();
  const checksum = verifyInstalledChecksum();
  const translation = measureTranslation();
  const latestBackup = readLatestBackup();

  return {
    workspace: WORKSPACE,
    gameRoot: GAME_ROOT,
    maindata: MAINDATA,
    running,
    missing,
    dbNames: { fileDb, checksumDb },
    files: {
      fileDb: statInfo(path.join(MAINDATA, fileDb)),
      checksumDb: statInfo(path.join(MAINDATA, checksumDb)),
      installedRda: statInfo(installedRda),
      packageRda: statInfo(PATHS.packageRda),
      payloadXml: statInfo(PATHS.payloadXml)
    },
    installedMatchesPackage: Boolean(packageHash && installedHash && packageHash === installedHash),
    checksum,
    translation,
    latestBackup
  };
}

ipcMain.handle('manager:getStatus', async () => buildStatus());
ipcMain.handle('manager:build', async (event) => runWorkflow(event, ['build']));
ipcMain.handle('manager:install', async (event) => runWorkflow(event, ['install']));
ipcMain.handle('manager:buildAndInstall', async (event) => runWorkflow(event, ['build', 'install']));
ipcMain.handle('manager:restore', async (event) => runWorkflow(event, ['restore']));

ipcMain.handle('manager:openPath', async (_event, key) => {
  const map = {
    workspace: WORKSPACE,
    game: GAME_ROOT,
    maindata: MAINDATA,
    package: PATHS.packageDir,
    backups: PATHS.backups,
    payload: path.dirname(PATHS.payloadXml),
    report: PATHS.report
  };
  const target = map[key];
  if (!target || !exists(target)) return { ok: false, message: 'المسار غير موجود.' };
  const result = await shell.openPath(target);
  return { ok: !result, message: result || 'تم الفتح.' };
});

ipcMain.handle('manager:showMessage', async (_event, options) => {
  return dialog.showMessageBox(mainWindow, options);
});

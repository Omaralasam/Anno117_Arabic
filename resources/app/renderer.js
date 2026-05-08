const els = {
  mainBadge: document.getElementById('mainBadge'),
  gameState: document.getElementById('gameState'),
  gameProcess: document.getElementById('gameProcess'),
  packageState: document.getElementById('packageState'),
  packageDetail: document.getElementById('packageDetail'),
  checksumState: document.getElementById('checksumState'),
  checksumDetail: document.getElementById('checksumDetail'),
  translationPercent: document.getElementById('translationPercent'),
  translationDetail: document.getElementById('translationDetail'),
  fileDbName: document.getElementById('fileDbName'),
  backupInfo: document.getElementById('backupInfo'),
  missingInfo: document.getElementById('missingInfo'),
  gamePathText: document.getElementById('gamePathText'),
  stage1Checks: document.getElementById('stage1Checks'),
  stage2Checks: document.getElementById('stage2Checks'),
  stage3Checks: document.getElementById('stage3Checks'),
  stage4Checks: document.getElementById('stage4Checks'),
  logBox: document.getElementById('logBox'),
  musicBtn: document.getElementById('musicBtn'),
  ambientAudio: document.getElementById('ambientAudio'),
  buttons: [...document.querySelectorAll('button:not(.window-control):not(#musicBtn)')]
};

let musicState = {
  playing: false,
  synth: null
};

let currentStage = 1;
let latestStatus = null;

const stageTitles = {
  1: 'اختيار مكان اللعبة',
  2: 'فحص الجاهزية',
  3: 'تثبيت التعريب',
  4: 'النتيجة والاستعادة'
};

function setStage(stage) {
  currentStage = stage;
  document.querySelectorAll('[data-stage]').forEach((page) => {
    page.classList.toggle('is-active', Number(page.dataset.stage) === stage);
  });
  document.querySelectorAll('[data-dot]').forEach((dot) => {
    dot.classList.toggle('is-active', Number(dot.dataset.dot) === stage);
  });
  const title = document.getElementById('stageTitle');
  if (title) title.textContent = stageTitles[stage] || stageTitles[1];
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return 'غير موجود';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatRunningNames(running) {
  return running.length === 1 ? running[0] : running.join(' و ');
}

function closeRunningHint(running) {
  return `أغلق ${formatRunningNames(running)} من شريط المهام أو مدير المهام، ثم اضغط فحص سريع.`;
}

function setClass(element, className) {
  element.classList.remove('ok', 'warn', 'bad');
  if (className) element.classList.add(className);
}

function getStatusChecks(status) {
  const files = status.files || {};
  const checks = status.checks || {};
  return {
    maindataExists: Boolean(checks.maindataExists),
    fileDbExists: Boolean(checks.fileDbExists || files.fileDb),
    checksumDbExists: Boolean(checks.checksumDbExists || files.checksumDb),
    sourceRdaExists: Boolean(checks.sourceRdaExists || files.installedRda),
    payloadExists: Boolean(checks.payloadExists || files.payloadXml),
    buildScriptsExist: Boolean(checks.buildScriptsExist),
    installScriptsExist: Boolean(checks.installScriptsExist),
    packageExists: Boolean(checks.packageExists || files.packageRda),
    latestBackupExists: Boolean(checks.latestBackupExists || status.latestBackup)
  };
}

function stageReadiness(status) {
  const checks = getStatusChecks(status);
  const running = status.running || [];
  const missing = status.missing || [];
  const stage1Ok = checks.maindataExists && checks.fileDbExists && checks.checksumDbExists && checks.sourceRdaExists;
  const stage2Ok = stage1Ok && running.length === 0 && missing.length === 0 && Boolean(status.checksum?.ok);
  const stage3Ok = stage2Ok && checks.payloadExists && checks.buildScriptsExist && checks.installScriptsExist;
  return { checks, stage1Ok, stage2Ok, stage3Ok };
}

function renderCheckList(element, checks) {
  if (!element) return;
  element.textContent = '';
  for (const item of checks) {
    const row = document.createElement('div');
    row.className = `check-item ${item.state}`;

    const icon = document.createElement('span');
    icon.className = 'check-item__icon';
    icon.textContent = item.state === 'ok' ? '✓' : item.state === 'warn' ? '!' : '×';

    const body = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const detail = document.createElement('small');
    detail.textContent = item.detail;

    body.append(title, detail);
    row.append(icon, body);
    element.append(row);
  }
}

function renderStageChecks(status) {
  const { checks } = stageReadiness(status);
  const running = status.running || [];
  const missing = status.missing || [];

  renderCheckList(els.stage1Checks, [
    {
      state: checks.maindataExists ? 'ok' : 'bad',
      title: 'مجلد اللعبة',
      detail: checks.maindataExists ? 'تم العثور على maindata.' : 'اختر مجلد اللعبة الصحيح.'
    },
    {
      state: checks.fileDbExists && checks.checksumDbExists ? 'ok' : 'bad',
      title: 'ملفات الفهرس',
      detail: checks.fileDbExists && checks.checksumDbExists ? 'file DB و checksum موجودان.' : 'ملفات الفهرس غير مكتملة.'
    },
    {
      state: checks.sourceRdaExists ? 'ok' : 'bad',
      title: 'أرشيف اللعبة',
      detail: checks.sourceRdaExists ? 'file_browse_patterns.rda موجود.' : 'الأرشيف المطلوب غير موجود.'
    }
  ]);

  renderCheckList(els.stage2Checks, [
    {
      state: running.length ? 'bad' : 'ok',
      title: 'إغلاق اللعبة واللانشر',
      detail: running.length ? closeRunningHint(running) : 'اللعبة و Ubisoft Connect مغلقة.'
    },
    {
      state: missing.length ? 'bad' : 'ok',
      title: 'ملفات الأداة',
      detail: missing.length ? `${missing.length} عنصر يحتاج مراجعة.` : 'كل ملفات البناء والتعريب موجودة.'
    },
    {
      state: status.checksum?.ok ? 'ok' : 'bad',
      title: 'سلامة الفهرس',
      detail: status.checksum?.message || 'لم يتم فحص checksum.'
    }
  ]);

  renderCheckList(els.stage3Checks, [
    {
      state: checks.payloadExists ? 'ok' : 'bad',
      title: 'ملف التعريب',
      detail: checks.payloadExists ? 'ملف النصوص العربية جاهز.' : 'ملف التعريب غير موجود.'
    },
    {
      state: checks.buildScriptsExist && checks.installScriptsExist ? 'ok' : 'bad',
      title: 'سكربتات البناء',
      detail: checks.buildScriptsExist && checks.installScriptsExist ? 'سكربتات البناء والتثبيت موجودة.' : 'يوجد سكربت ناقص.'
    },
    {
      state: running.length ? 'bad' : 'ok',
      title: 'جاهزية التثبيت',
      detail: running.length ? closeRunningHint(running) : 'آمن للبدء.'
    }
  ]);

  renderCheckList(els.stage4Checks, [
    {
      state: status.installedMatchesPackage ? 'ok' : 'warn',
      title: 'مطابقة الحزمة',
      detail: status.installedMatchesPackage ? 'تعريب maindata يطابق الحزمة.' : 'الحزمة غير مركبة أو لم تتم المطابقة بعد.'
    },
    {
      state: status.translation ? (status.translation.percent >= 95 ? 'ok' : 'warn') : 'bad',
      title: 'نسبة التعريب',
      detail: status.translation ? `${status.translation.percent}% من النصوص عربية.` : 'تعذر قراءة ملف التعريب.'
    },
    {
      state: checks.latestBackupExists ? 'ok' : 'warn',
      title: 'النسخة الاحتياطية',
      detail: checks.latestBackupExists ? 'توجد نسخة يمكن الرجوع إليها.' : 'لا توجد نسخة مسجلة بعد.'
    }
  ]);
}

function updateGateButtons(status) {
  const ready = stageReadiness(status);
  document.getElementById('goStage2Btn').disabled = !ready.stage1Ok;
  document.getElementById('goStage3Btn').disabled = !ready.stage2Ok;
  document.getElementById('buildAndInstallBtn').disabled = !ready.stage3Ok;
  document.getElementById('buildBtn').disabled = !(ready.checks.payloadExists && ready.checks.buildScriptsExist && ready.stage1Ok);
  document.getElementById('installBtn').disabled = !(ready.checks.packageExists && ready.checks.installScriptsExist && (status.running || []).length === 0);
}

function guardMessage(targetStage, status) {
  const ready = stageReadiness(status);
  if (targetStage === 2 && !ready.stage1Ok) {
    return 'لا يمكن الانتقال للفحص قبل اختيار مجلد لعبة صحيح يحتوي على maindata وملفات الفهرس.';
  }
  if (targetStage === 3 && !ready.stage2Ok) {
    return 'لا يمكن الانتقال للتثبيت قبل نجاح فحص الجاهزية وإغلاق اللعبة و Ubisoft Connect.';
  }
  return null;
}

async function trySetStage(stage) {
  const status = await refreshStatus();
  const message = guardMessage(stage, status);
  if (message) {
    appendLog('warn', `\n${message}\n`);
    return;
  }
  setStage(stage);
}

function appendLog(type, text) {
  const prefix = type === 'step' ? '\n' : '';
  els.logBox.textContent += `${prefix}${text}`;
  els.logBox.scrollTop = els.logBox.scrollHeight;
}

function setBusy(isBusy) {
  for (const button of els.buttons) button.disabled = isBusy;
}

function createAmbientSynth() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  const context = new AudioContext();
  const master = context.createGain();
  const filter = context.createBiquadFilter();
  const delay = context.createDelay();
  const feedback = context.createGain();

  master.gain.value = 0.0001;
  filter.type = 'lowpass';
  filter.frequency.value = 760;
  delay.delayTime.value = 0.38;
  feedback.gain.value = 0.18;

  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(master);
  filter.connect(master);
  master.connect(context.destination);

  const notes = [146.83, 196.0, 220.0, 293.66];
  const oscillators = notes.map((frequency, index) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = index % 2 ? 'triangle' : 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.12 : 0.035;
    osc.connect(gain);
    gain.connect(filter);
    osc.start();
    return osc;
  });

  master.gain.linearRampToValueAtTime(0.045, context.currentTime + 1.5);

  return {
    context,
    stop() {
      master.gain.linearRampToValueAtTime(0.0001, context.currentTime + 0.4);
      setTimeout(() => {
        for (const osc of oscillators) osc.stop();
        context.close();
      }, 500);
    }
  };
}

function updateMusicButton(isPlaying) {
  els.musicBtn.classList.toggle('is-playing', isPlaying);
  els.musicBtn.innerHTML = isPlaying
    ? '<span aria-hidden="true">■</span> إيقاف الموسيقى'
    : '<span aria-hidden="true">♪</span> موسيقى اللعبة';
}

function stopMusic() {
  els.ambientAudio.pause();
  els.ambientAudio.currentTime = 0;
  musicState.synth?.stop();
  musicState = { playing: false, synth: null };
  updateMusicButton(false);
}

async function startMusic({ logOnFailure = true } = {}) {
  if (musicState.playing) return true;
  els.ambientAudio.volume = 0.32;
  try {
    await els.ambientAudio.play();
    musicState.playing = true;
  } catch {
    musicState.synth = createAmbientSynth();
    musicState.playing = Boolean(musicState.synth);
  }

  if (musicState.playing) {
    updateMusicButton(true);
  } else if (logOnFailure) {
    appendLog('warn', '\nتعذر تشغيل الموسيقى على هذا الجهاز.\n');
  }
  return musicState.playing;
}

async function toggleMusic() {
  if (musicState.playing) {
    stopMusic();
    return;
  }

  await startMusic();
}

function renderStatus(status) {
  latestStatus = status;
  const running = status.running || [];
  const missing = status.missing || [];

  els.gamePathText.textContent = status.gameRoot || 'لم يتم اختيار مكان اللعبة.';

  if (running.length) {
    els.gameState.textContent = 'تحتاج إغلاق';
    els.gameProcess.textContent = closeRunningHint(running);
    setClass(els.gameState, 'warn');
  } else {
    els.gameState.textContent = 'مغلقة';
    els.gameProcess.textContent = 'جاهزة للتثبيت أو الاستعادة.';
    setClass(els.gameState, 'ok');
  }

  if (status.installedMatchesPackage) {
    els.packageState.textContent = 'مركبة';
    els.packageDetail.textContent = 'نسخة maindata تطابق الحزمة الجاهزة.';
    setClass(els.packageState, 'ok');
  } else if (status.files.packageRda) {
    els.packageState.textContent = 'جاهزة';
    els.packageDetail.textContent = `الحزمة: ${formatSize(status.files.packageRda.size)}`;
    setClass(els.packageState, 'warn');
  } else {
    els.packageState.textContent = 'غير مبنية';
    els.packageDetail.textContent = 'اضغط جهز الحزمة أولاً.';
    setClass(els.packageState, 'bad');
  }

  els.checksumState.textContent = status.checksum.ok ? 'سليم' : 'يحتاج فحص';
  els.checksumDetail.textContent = status.checksum.message;
  setClass(els.checksumState, status.checksum.ok ? 'ok' : 'bad');

  if (status.translation) {
    els.translationPercent.textContent = `${status.translation.percent}%`;
    els.translationDetail.textContent = `${status.translation.arabic}/${status.translation.total} سطر عربي، ${status.translation.latin} سطر يحتوي لاتيني.`;
    setClass(els.translationPercent, status.translation.percent >= 95 ? 'ok' : 'warn');
  } else {
    els.translationPercent.textContent = 'غير معروف';
    els.translationDetail.textContent = 'ملف الترجمة غير موجود.';
    setClass(els.translationPercent, 'bad');
  }

  els.fileDbName.textContent = `${status.dbNames.fileDb} / ${status.dbNames.checksumDb}`;
  els.backupInfo.textContent = status.latestBackup ? status.latestBackup.path : 'لا توجد نسخة مسجلة.';
  els.missingInfo.textContent = missing.length ? `${missing.length} ملف ناقص` : 'كل الملفات الأساسية موجودة.';
  setClass(els.missingInfo, missing.length ? 'bad' : 'ok');

  if (missing.length) {
    els.mainBadge.textContent = 'ملفات ناقصة';
    setClass(els.mainBadge, 'bad');
  } else if (running.length) {
    els.mainBadge.textContent = 'أغلق اللعبة أولاً';
    setClass(els.mainBadge, 'bad');
  } else if (status.installedMatchesPackage && status.checksum.ok) {
    els.mainBadge.textContent = 'التعريب مركب';
    setClass(els.mainBadge, 'ok');
  } else {
    els.mainBadge.textContent = 'جاهز للعمل';
    setClass(els.mainBadge, 'warn');
  }

  renderStageChecks(status);
  updateGateButtons(status);
}

async function refreshStatus() {
  const status = await window.arabicManager.getStatus();
  renderStatus(status);
  return status;
}

async function runAction(label, action) {
  setBusy(true);
  els.logBox.textContent = `${label}\n`;
  let succeeded = false;
  try {
    const status = await action();
    renderStatus(status);
    appendLog('success', '\nتمت العملية بنجاح.\n');
    succeeded = true;
  } catch (error) {
    appendLog('error', `\nخطأ: ${error.message || error}\n`);
  } finally {
    setBusy(false);
    await refreshStatus().catch(() => {});
  }
  return succeeded;
}

async function showInstallSuccessDialog() {
  if (!window.arabicManager.showMessage) return;

  const result = await window.arabicManager.showMessage({
    type: 'info',
    title: 'تم تثبيت التعريب',
    message: 'تم تثبيت التعريب بنجاح.',
    detail: 'يمكنك تشغيل اللعبة الآن. إذا ظهرت مشكلة، ارجع للمرحلة الأخيرة واستعد آخر نسخة احتياطية.',
    buttons: ['حسنًا', 'فتح مجلد اللعبة', 'الذهاب للاستعادة'],
    defaultId: 0,
    cancelId: 0
  });

  if (result.response === 1) {
    await window.arabicManager.openPath('maindata');
  }
  if (result.response === 2) {
    setStage(4);
  }
}

window.arabicManager.onLog((payload) => appendLog(payload.type, payload.text));

document.getElementById('refreshBtn').addEventListener('click', () => {
  runAction('تحديث الحالة...\n', () => refreshStatus());
});

document.getElementById('chooseGameBtn').addEventListener('click', async () => {
  setBusy(true);
  try {
    const result = await window.arabicManager.chooseGameFolder();
    if (result.status) renderStatus(result.status);
    if (result.canceled) {
      appendLog('info', '\nلم يتم اختيار مجلد.\n');
    } else {
      appendLog(result.ok ? 'success' : 'error', `\n${result.message}\n`);
      if (result.ok) setStage(2);
    }
  } catch (error) {
    appendLog('error', `\nخطأ: ${error.message || error}\n`);
  } finally {
    setBusy(false);
    await refreshStatus().catch(() => {});
  }
});

document.getElementById('buildBtn').addEventListener('click', () => {
  runAction('تجهيز الحزمة بدون لمس ملفات اللعبة...\n', () => window.arabicManager.build());
});

document.getElementById('installBtn').addEventListener('click', () => {
  runAction('تثبيت آخر حزمة جاهزة...\n', () => window.arabicManager.install()).then((ok) => {
    if (ok) showInstallSuccessDialog();
  });
});

document.getElementById('buildAndInstallBtn').addEventListener('click', () => {
  runAction('تجهيز وتثبيت التعريب...\n', () => window.arabicManager.buildAndInstall()).then((ok) => {
    if (ok) {
      setStage(4);
      showInstallSuccessDialog();
    }
  });
});

document.getElementById('restoreBtn').addEventListener('click', () => {
  runAction('استعادة آخر نسخة احتياطية...\n', () => window.arabicManager.restore());
});

document.querySelectorAll('[data-open]').forEach((button) => {
  button.addEventListener('click', async () => {
    const result = await window.arabicManager.openPath(button.dataset.open);
    appendLog(result.ok ? 'info' : 'error', `\n${result.message}\n`);
  });
});

document.querySelectorAll('[data-external-url]').forEach((button) => {
  button.addEventListener('click', async () => {
    const result = await window.arabicManager.openExternal(button.dataset.externalUrl);
    appendLog(result.ok ? 'info' : 'error', `\n${result.message}\n`);
  });
});

els.musicBtn.addEventListener('click', () => {
  toggleMusic();
});

document.querySelectorAll('[data-window-action]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.windowAction;
    if (action === 'minimize') window.arabicManager.windowMinimize();
    if (action === 'maximize') window.arabicManager.windowToggleMaximize();
    if (action === 'close') window.arabicManager.windowClose();
  });
});

document.getElementById('goStage2Btn').addEventListener('click', () => trySetStage(2));
document.getElementById('backStage1Btn').addEventListener('click', () => setStage(1));
document.getElementById('goStage3Btn').addEventListener('click', () => trySetStage(3));
document.getElementById('backStage2Btn').addEventListener('click', () => setStage(2));
document.getElementById('goStage4Btn').addEventListener('click', () => setStage(4));
document.getElementById('backStage3Btn').addEventListener('click', () => setStage(3));

document.getElementById('introCloseBtn').addEventListener('click', () => {
  document.getElementById('introModal').classList.add('is-hidden');
});

setStage(1);

refreshStatus().catch((error) => {
  els.logBox.textContent = `تعذر قراءة الحالة: ${error.message || error}`;
});

setTimeout(() => {
  startMusic({ logOnFailure: false });
}, 500);

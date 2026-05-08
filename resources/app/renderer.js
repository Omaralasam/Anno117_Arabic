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
  logBox: document.getElementById('logBox'),
  musicBtn: document.getElementById('musicBtn'),
  ambientAudio: document.getElementById('ambientAudio'),
  buttons: [...document.querySelectorAll('button')]
};

let musicState = {
  playing: false,
  synth: null
};

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

function setClass(element, className) {
  element.classList.remove('ok', 'warn', 'bad');
  if (className) element.classList.add(className);
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

async function toggleMusic() {
  if (musicState.playing) {
    els.ambientAudio.pause();
    els.ambientAudio.currentTime = 0;
    musicState.synth?.stop();
    musicState = { playing: false, synth: null };
    els.musicBtn.classList.remove('is-playing');
    els.musicBtn.innerHTML = '<span aria-hidden="true">♪</span> موسيقى الواجهة';
    return;
  }

  els.ambientAudio.volume = 0.32;
  try {
    await els.ambientAudio.play();
    musicState.playing = true;
  } catch {
    musicState.synth = createAmbientSynth();
    musicState.playing = Boolean(musicState.synth);
  }

  if (musicState.playing) {
    els.musicBtn.classList.add('is-playing');
    els.musicBtn.innerHTML = '<span aria-hidden="true">■</span> إيقاف الموسيقى';
  } else {
    appendLog('warn', '\nتعذر تشغيل الموسيقى على هذا الجهاز.\n');
  }
}

function renderStatus(status) {
  const running = status.running || [];
  const missing = status.missing || [];

  if (running.length) {
    els.gameState.textContent = 'مفتوحة';
    els.gameProcess.textContent = `عمليات نشطة: ${running.join(', ')}`;
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
  } else if (status.installedMatchesPackage && status.checksum.ok) {
    els.mainBadge.textContent = 'التعريب مركب';
    setClass(els.mainBadge, 'ok');
  } else {
    els.mainBadge.textContent = 'جاهز للعمل';
    setClass(els.mainBadge, 'warn');
  }
}

async function refreshStatus() {
  const status = await window.arabicManager.getStatus();
  renderStatus(status);
  return status;
}

async function runAction(label, action) {
  setBusy(true);
  els.logBox.textContent = `${label}\n`;
  try {
    const status = await action();
    renderStatus(status);
    appendLog('success', '\nتمت العملية بنجاح.\n');
  } catch (error) {
    appendLog('error', `\nERROR: ${error.message || error}\n`);
  } finally {
    setBusy(false);
    await refreshStatus().catch(() => {});
  }
}

window.arabicManager.onLog((payload) => appendLog(payload.type, payload.text));

document.getElementById('refreshBtn').addEventListener('click', () => {
  runAction('تحديث الحالة...\n', () => refreshStatus());
});

document.getElementById('buildBtn').addEventListener('click', () => {
  runAction('تجهيز الحزمة بدون لمس ملفات اللعبة...\n', () => window.arabicManager.build());
});

document.getElementById('installBtn').addEventListener('click', () => {
  runAction('تثبيت آخر حزمة جاهزة...\n', () => window.arabicManager.install());
});

document.getElementById('buildAndInstallBtn').addEventListener('click', () => {
  runAction('تجهيز وتثبيت التعريب...\n', () => window.arabicManager.buildAndInstall());
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

els.musicBtn.addEventListener('click', () => {
  toggleMusic();
});

refreshStatus().catch((error) => {
  els.logBox.textContent = `تعذر قراءة الحالة: ${error.message || error}`;
});

/* =========================================
   FOKUSIN — Timer, Blokir Distraksi, Statistik
========================================= */

// ---------- ELEMEN ----------
const timeEl       = document.getElementById('time');
const statusEl     = document.getElementById('status');
const startBtn     = document.getElementById('startBtn');
const resetBtn     = document.getElementById('resetBtn');
const ringProgress = document.getElementById('ringProgress');
const modeBtns     = document.querySelectorAll('.mode');
const blockCard    = document.getElementById('blockCard');
const blockForm    = document.getElementById('blockForm');
const blockInput   = document.getElementById('blockInput');
const blockList    = document.getElementById('blockList');
const statSessions = document.getElementById('statSessions');
const statMinutes  = document.getElementById('statMinutes');
const statDistract = document.getElementById('statDistract');
const resetStats   = document.getElementById('resetStats');

// ---------- KONSTANTA ----------
const RING_LENGTH = 603; // 2π * 96
const STORAGE_KEY = 'fokusin_v1';
const DEFAULT_BLOCKS = ['Instagram', 'TikTok', 'YouTube', 'Game'];

// ---------- STATE ----------
let totalSeconds = 25 * 60;
let remaining    = totalSeconds;
let timerId      = null;
let isRunning    = false;
let currentMode  = { min: 25, label: 'Fokus' };

// data tersimpan
let data = {
  sessions: 0,
  minutes: 0,
  distractions: 0,
  blocks: [...DEFAULT_BLOCKS]
};

// ---------- LOAD DATA ----------
function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      data = { ...data, ...saved };
    }
  } catch (e) {
    console.warn('Gagal load data:', e);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------- RENDER STATISTIK ----------
function renderStats() {
  statSessions.textContent = data.sessions;
  statMinutes.textContent  = data.minutes;
  statDistract.textContent = data.distractions;
}

// ---------- RENDER DAFTAR BLOKIR ----------
function renderBlocks() {
  blockList.innerHTML = '';
  data.blocks.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = item;

    const del = document.createElement('button');
    del.type = 'button';
    del.innerHTML = '&times;';
    del.title = 'Hapus';
    del.addEventListener('click', () => removeBlock(index));

    li.appendChild(del);
    blockList.appendChild(li);
  });
}

function addBlock(name) {
  const clean = name.trim();
  if (!clean) return;
  // hindari duplikat (case-insensitive)
  if (data.blocks.some(b => b.toLowerCase() === clean.toLowerCase())) {
    blockInput.value = '';
    return;
  }
  data.blocks.push(clean);
  saveData();
  renderBlocks();
  blockInput.value = '';
}

function removeBlock(index) {
  if (isRunning) return; // terkunci saat timer jalan
  data.blocks.splice(index, 1);
  saveData();
  renderBlocks();
}

// ---------- TIMER UI ----------
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerUI() {
  timeEl.textContent = formatTime(remaining);
  const progress = 1 - remaining / totalSeconds;
  ringProgress.style.strokeDashoffset = RING_LENGTH * progress;
}

// ---------- KONTROL TIMER ----------
function startTimer() {
  if (isRunning) {
    pauseTimer();
    return;
  }

  isRunning = true;
  startBtn.textContent = 'Jeda';
  statusEl.textContent = currentMode.label + '...';
  blockCard.classList.add('locked');

  timerId = setInterval(() => {
    remaining--;
    updateTimerUI();

    if (remaining <= 0) {
      finishSession();
    }
  }, 1000);
}

function pauseTimer() {
  isRunning = false;
  clearInterval(timerId);
  startBtn.textContent = 'Lanjut';
  statusEl.textContent = 'Dijeda';
}

function resetTimer() {
  isRunning = false;
  clearInterval(timerId);
  remaining = totalSeconds;
  startBtn.textContent = 'Mulai';
  statusEl.textContent = 'Siap mulai';
  blockCard.classList.remove('locked');
  updateTimerUI();
}

function finishSession() {
  clearInterval(timerId);
  isRunning = false;
  startBtn.textContent = 'Mulai';
  statusEl.textContent = '✅ Selesai!';
  blockCard.classList.remove('locked');

  // update statistik hanya untuk sesi fokus
  if (currentMode.label === 'Fokus') {
    data.sessions += 1;
    data.minutes  += Math.round(totalSeconds / 60);
    saveData();
    renderStats();
  }

  // efek suara sederhana (opsional)
  playBeep();

  // reset setelah jeda sebentar
  setTimeout(() => {
    remaining = totalSeconds;
    statusEl.textContent = 'Siap mulai';
    updateTimerUI();
  }, 1500);
}

// beep pakai Web Audio API (tanpa file)
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) { /* abaikan */ }
}

// ---------- GANTI MODE ----------
function setMode(min, label, btn) {
  if (isRunning) {
    // izinkan ganti mode hanya jika timer dijeda? lebih baik reset dulu
    if (!confirm('Timer sedang berjalan. Reset dan ganti mode?')) return;
    resetTimer();
  }

  modeBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  currentMode = { min, label };
  totalSeconds = min * 60;
  remaining = totalSeconds;

  // warna ring beda untuk istirahat
  if (label === 'Istirahat') {
    statusEl.textContent = 'Waktunya istirahat';
  } else {
    statusEl.textContent = 'Siap mulai';
  }

  startBtn.textContent = 'Mulai';
  blockCard.classList.remove('locked');
  updateTimerUI();
}

// ---------- DETEKSI DISTRAKSI ----------
// hitung pindah tab saat timer fokus berjalan
let hiddenAt = null;

document.addEventListener('visibilitychange', () => {
  if (!isRunning || currentMode.label !== 'Fokus') return;

  if (document.hidden) {
    hiddenAt = Date.now();
  } else if (hiddenAt) {
    const away = (Date.now() - hiddenAt) / 1000;
    if (away > 5) { // pindah tab > 5 detik dihitung distraksi
      data.distractions += 1;
      saveData();
      renderStats();
    }
    hiddenAt = null;
  }
});

// ---------- EVENT LISTENER ----------
startBtn.addEventListener('click', startTimer);
resetBtn.addEventListener('click', resetTimer);

modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const min = parseInt(btn.dataset.min, 10);
    const label = btn.dataset.label;
    setMode(min, label, btn);
  });
});

blockForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (isRunning) return;
  addBlock(blockInput.value);
});

resetStats.addEventListener('click', () => {
  if (!confirm('Reset semua statistik?')) return;
  data.sessions = 0;
  data.minutes = 0;
  data.distractions = 0;
  saveData();
  renderStats();
});

// jaga-jaga: hitung durasi pindah tab terlalu lama = reset timer? tidak, cukup statistik.

// ---------- INIT ----------
function init() {
  loadData();
  renderStats();
  renderBlocks();
  updateTimerUI();
  statusEl.textContent = 'Siap mulai';
}

init();

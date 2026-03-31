/* ========================================
   KONSTANTA
======================================== */
const API = '/api/tasks';

const MONTH_NAMES = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

const DAY_NAMES = [
  'Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'
];

const CATEGORY_LABELS = {
  work: 'Kerja', personal: 'Pribadi',
  health: 'Kesehatan', study: 'Belajar', other: 'Lainnya'
};

const TOAST_ICONS = {
  success: 'fa-circle-check',
  info: 'fa-circle-info',
  danger: 'fa-circle-xmark',
  error: 'fa-circle-xmark'
};

/* ========================================
   STATE
======================================== */
let currentYear, currentMonth;
let selectedDate = '';
let selectedCategory = 'work';

// Cache data bulan yang sedang ditampilkan
// Format: { 'YYYY-MM-DD': [{ id, date_key, done }] }
let monthCache = {};

/* ========================================
   DATE HELPERS
======================================== */
function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatDateIndo(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]}, ${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ========================================
   API HELPERS
======================================== */
async function apiFetch(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server error' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    setSyncStatus(false);
    throw err;
  }
}

function setSyncStatus(online) {
  const chip = document.getElementById('syncChip');
  const icon = document.getElementById('syncIcon');
  const label = document.getElementById('syncLabel');

  if (online) {
    chip.classList.remove('offline');
    icon.className = 'fa-solid fa-database';
    label.textContent = 'Terhubung';
  } else {
    chip.classList.add('offline');
    icon.className = 'fa-solid fa-triangle-exclamation';
    label.textContent = 'Offline';
  }
}

/* ========================================
   AMBIL DATA BULAN DARI SERVER
======================================== */
async function fetchMonthData() {
  try {
    const rows = await apiFetch(
      `${API}?view=month&year=${currentYear}&month=${currentMonth + 1}`
    );
    monthCache = {};
    rows.forEach(row => {
      if (!monthCache[row.date_key]) monthCache[row.date_key] = [];
      monthCache[row.date_key].push(row);
    });
    setSyncStatus(true);
  } catch {
    showToast('Gagal memuat data kalender', 'error');
  }
}

/* ========================================
   KALENDER RENDER
======================================== */
async function renderCalendar() {
  const monthLabel = document.getElementById('monthLabel');
  monthLabel.innerHTML = `${MONTH_NAMES[currentMonth]}<span>${currentYear}</span>`;

  // Ambil data bulan ini dari server
  await fetchMonthData();

  const daysGrid = document.getElementById('daysGrid');
  daysGrid.innerHTML = '';

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const today = todayKey();

  // Hari bulan sebelumnya
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const pm = currentMonth === 0 ? 11 : currentMonth - 1;
    const py = currentMonth === 0 ? currentYear - 1 : currentYear;
    const key = dateKey(py, pm, d);
    daysGrid.appendChild(createDayCell(d, key, true));
  }

  // Hari bulan ini
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(currentYear, currentMonth, d);
    const isToday = key === today;
    const isSelected = key === selectedDate;
    daysGrid.appendChild(createDayCell(d, key, false, isToday, isSelected));
  }

  // Sisa bulan berikutnya
  const totalCells = firstDay + daysInMonth;
  const remaining = (totalCells <= 35 ? 35 : 42) - totalCells;
  for (let d = 1; d <= remaining; d++) {
    const nm = currentMonth === 11 ? 0 : currentMonth + 1;
    const ny = currentMonth === 11 ? currentYear + 1 : currentYear;
    const key = dateKey(ny, nm, d);
    daysGrid.appendChild(createDayCell(d, key, true));
  }
}

function createDayCell(dayNum, key, isOtherMonth, isToday, isSelected) {
  const cell = document.createElement('div');
  cell.className = 'day-cell';
  if (isOtherMonth) cell.classList.add('other-month');
  if (isToday) cell.classList.add('today');
  if (isSelected) cell.classList.add('selected');

  cell.setAttribute('role', 'button');
  cell.setAttribute('aria-label', `${dayNum} ${isOtherMonth ? 'bulan lain' : ''}`);
  cell.tabIndex = 0;

  const numSpan = document.createElement('span');
  numSpan.className = 'day-num';
  numSpan.textContent = dayNum;
  cell.appendChild(numSpan);

  // Dot indicator dari cache
  const dayTasks = monthCache[key] || [];
  if (dayTasks.length > 0) {
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'task-dots';
    const maxDots = Math.min(dayTasks.length, 4);
    for (let i = 0; i < maxDots; i++) {
      const dot = document.createElement('span');
      dot.className = 'task-dot' + (dayTasks[i].done ? ' done' : '');
      dotsDiv.appendChild(dot);
    }
    cell.appendChild(dotsDiv);
  }

  cell.addEventListener('click', () => selectDate(key));
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectDate(key);
    }
  });

  return cell;
}

/* ========================================
   PILIH TANGGAL
======================================== */
function selectDate(key) {
  selectedDate = key;
  renderCalendar();
  renderTasks();
}

/* ========================================
   TASK RENDER
======================================== */
async function renderTasks() {
  const taskList = document.getElementById('taskList');
  const taskDateLabel = document.getElementById('taskDateLabel');
  const progressSection = document.getElementById('progressSection');

  taskDateLabel.innerHTML = formatDateIndo(selectedDate);

  // Tampilkan loading sementara
  taskList.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
      <h3>Memuat...</h3>
    </div>
  `;
  progressSection.style.display = 'none';

  try {
    const dayTasks = await apiFetch(`${API}?date=${selectedDate}`);
    setSyncStatus(true);

    if (dayTasks.length === 0) {
      taskList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-regular fa-clipboard"></i></div>
          <h3>Belum Ada Tugas</h3>
          <p>Klik tombol + untuk menambahkan tugas baru pada tanggal ini.</p>
        </div>
      `;
      return;
    }

    // Update cache
    monthCache[selectedDate] = dayTasks;

    // Sort: belum selesai dulu, lalu by waktu
    const sorted = [...dayTasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });

    taskList.innerHTML = sorted.map((task) => `
      <div class="task-item ${task.done ? 'done' : ''}" data-id="${task.id}">
        <div class="task-checkbox ${task.done ? 'checked' : ''}"
             role="checkbox" aria-checked="${task.done}" tabindex="0"
             onclick="toggleTask(${task.id})"
             onkeydown="if(event.key==='Enter')toggleTask(${task.id})">
          ${task.done ? '<i class="fa-solid fa-check"></i>' : ''}
        </div>
        <div class="task-content">
          <div class="task-text">${escapeHtml(task.text)}</div>
          ${task.note ? `<div class="task-time"><i class="fa-solid fa-comment"></i> ${escapeHtml(task.note)}</div>` : ''}
          ${task.time ? `<div class="task-time"><i class="fa-regular fa-clock"></i> ${task.time}</div>` : ''}
          <span class="task-category cat-${task.category}">${CATEGORY_LABELS[task.category] || 'Lainnya'}</span>
        </div>
        <button class="task-delete" onclick="deleteTask(${task.id})" aria-label="Hapus tugas">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');

    // Progress
    const doneCount = dayTasks.filter(t => t.done).length;
    const pct = Math.round((doneCount / dayTasks.length) * 100);
    progressSection.style.display = 'block';
    document.getElementById('progressPct').textContent = `${pct}%`;
    document.getElementById('progressFill').style.width = `${pct}%`;

  } catch {
    taskList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="background:var(--danger-soft);color:var(--danger);">
          <i class="fa-solid fa-wifi-slash"></i>
        </div>
        <h3>Gagal Memuat</h3>
        <p>Tidak bisa terhubung ke server. Coba refresh halaman.</p>
      </div>
    `;
  }

  updateStats();
}

/* ========================================
   TASK ACTIONS (semua async ke server)
======================================== */
async function toggleTask(id) {
  // Cari data saat ini dari DOM untuk tahu nilai done yang baru
  const item = document.querySelector(`.task-item[data-id="${id}"]`);
  if (!item) return;

  const isCurrentlyDone = item.classList.contains('done');

  // Optimistic update langsung di UI
  const checkbox = item.querySelector('.task-checkbox');
  if (isCurrentlyDone) {
    item.classList.remove('done');
    checkbox.classList.remove('checked');
    checkbox.innerHTML = '';
    checkbox.setAttribute('aria-checked', 'false');
  } else {
    item.classList.add('done');
    checkbox.classList.add('checked');
    checkbox.innerHTML = '<i class="fa-solid fa-check"></i>';
    checkbox.setAttribute('aria-checked', 'true');
  }

  // Kirim ke server
  try {
    await apiFetch(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !isCurrentlyDone })
    });
    setSyncStatus(true);
    showToast(!isCurrentlyDone ? 'Tugas selesai!' : 'Tugas dibatalkan', !isCurrentlyDone ? 'success' : 'info');

    // Refresh progress & stats
    const dayTasks = await apiFetch(`${API}?date=${selectedDate}`);
    monthCache[selectedDate] = dayTasks;
    const doneCount = dayTasks.filter(t => t.done).length;
    const pct = Math.round((doneCount / dayTasks.length) * 100);
    document.getElementById('progressPct').textContent = `${pct}%`;
    document.getElementById('progressFill').style.width = `${pct}%`;
    updateStats();

    // Update dot di kalender
    updateMonthCacheDot(id, !isCurrentlyDone);
  } catch {
    // Rollback jika gagal
    if (isCurrentlyDone) {
      item.classList.add('done');
      checkbox.classList.add('checked');
      checkbox.innerHTML = '<i class="fa-solid fa-check"></i>';
      checkbox.setAttribute('aria-checked', 'true');
    } else {
      item.classList.remove('done');
      checkbox.classList.remove('checked');
      checkbox.innerHTML = '';
      checkbox.setAttribute('aria-checked', 'false');
    }
    showToast('Gagal menyimpan. Cek koneksi.', 'error');
  }
}

function updateMonthCacheDot(id, newDone) {
  // Update cache supaya dot di kalender langsung berubah tanpa fetch ulang
  for (const key in monthCache) {
    const arr = monthCache[key];
    const found = arr.find(t => t.id === id);
    if (found) {
      found.done = newDone ? 1 : 0;
      break;
    }
  }
  // Re-render hanya dots di kalender
  refreshCalendarDots();
}

function refreshCalendarDots() {
  document.querySelectorAll('.day-cell').forEach(cell => {
    const dotsDiv = cell.querySelector('.task-dots');
    if (dotsDiv) dotsDiv.remove();

    // Cari key dari cell — ambil dari event listener atau data
    // Lebih simpel: re-check setiap cell
    const numEl = cell.querySelector('.day-num');
    if (!numEl) return;
  });
  // Cara paling bersih: re-render kalender tanpa fetch ulang
  renderCalendarSilent();
}

async function renderCalendarSilent() {
  // Render ulang kalender pakai cache yang sudah ada (tanpa fetch ke server)
  const daysGrid = document.getElementById('daysGrid');
  daysGrid.innerHTML = '';

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const today = todayKey();

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const pm = currentMonth === 0 ? 11 : currentMonth - 1;
    const py = currentMonth === 0 ? currentYear - 1 : currentYear;
    const key = dateKey(py, pm, d);
    daysGrid.appendChild(createDayCell(d, key, true));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(currentYear, currentMonth, d);
    daysGrid.appendChild(createDayCell(d, key, false, key === today, key === selectedDate));
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = (totalCells <= 35 ? 35 : 42) - totalCells;
  for (let d = 1; d <= remaining; d++) {
    const nm = currentMonth === 11 ? 0 : currentMonth + 1;
    const ny = currentMonth === 11 ? currentYear + 1 : currentYear;
    const key = dateKey(ny, nm, d);
    daysGrid.appendChild(createDayCell(d, key, true));
  }
}

async function deleteTask(id) {
  const item = document.querySelector(`.task-item[data-id="${id}"]`);
  if (!item) return;

  item.classList.add('deleting');

  setTimeout(async () => {
    try {
      await apiFetch(`${API}/${id}`, { method: 'DELETE' });
      setSyncStatus(true);

      // Hapus dari cache
      for (const key in monthCache) {
        monthCache[key] = monthCache[key].filter(t => t.id !== id);
        if (monthCache[key].length === 0) delete monthCache[key];
      }

      renderCalendarSilent();
      renderTasks();
      showToast('Tugas dihapus', 'danger');
    } catch {
      item.classList.remove('deleting');
      showToast('Gagal menghapus. Cek koneksi.', 'error');
    }
  }, 350);
}

async function addTask(text, time, note, category) {
  try {
    const newRow = await apiFetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_key: selectedDate,
        text: text.trim(),
        time: time || '',
        note: note || '',
        category: category || 'other'
      })
    });
    setSyncStatus(true);

    // Tambah ke cache
    if (!monthCache[selectedDate]) monthCache[selectedDate] = [];
    monthCache[selectedDate].push(newRow);

    renderCalendarSilent();
    renderTasks();
    showToast('Tugas ditambahkan', 'success');
  } catch {
    showToast('Gagal menambahkan. Cek koneksi.', 'error');
  }
}

/* ========================================
   STATISTIK (per tanggal yang dipilih)
======================================== */
function updateStats() {
  const dayTasks = monthCache[selectedDate] || [];
  const done = dayTasks.filter(t => t.done).length;
  document.getElementById('statTotal').textContent = dayTasks.length;
  document.getElementById('statDone').textContent = done;
}
/* ========================================
   MODAL LOGIC
======================================== */
const modalOverlay = document.getElementById('modalOverlay');
const taskInput = document.getElementById('taskInput');
const taskTime = document.getElementById('taskTime');
const taskNote = document.getElementById('taskNote');
const categoryBtns = document.querySelectorAll('.cat-option');

function openModal() {
  taskInput.value = '';
  taskTime.value = '';
  taskNote.value = '';
  selectedCategory = 'work';
  categoryBtns.forEach(b => b.classList.toggle('active', b.dataset.cat === 'work'));
  modalOverlay.classList.add('active');
  setTimeout(() => taskInput.focus(), 300);
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

document.getElementById('addTaskBtn').addEventListener('click', openModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
});

categoryBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedCategory = btn.dataset.cat;
    categoryBtns.forEach(b => b.classList.toggle('active', b === btn));
  });
});

document.getElementById('modalSubmit').addEventListener('click', () => {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.style.borderColor = 'var(--danger)';
    taskInput.style.boxShadow = '0 0 0 3px var(--danger-soft)';
    taskInput.focus();
    setTimeout(() => {
      taskInput.style.borderColor = '';
      taskInput.style.boxShadow = '';
    }, 1500);
    return;
  }
  addTask(text, taskTime.value, taskNote.value, selectedCategory);
  closeModal();
});

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('modalSubmit').click();
  }
});

/* ========================================
   NAVIGASI BULAN
======================================== */
document.getElementById('prevMonth').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  monthCache = {};
  renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  monthCache = {};
  renderCalendar();
});

document.getElementById('todayBtn').addEventListener('click', () => {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  selectedDate = todayKey();
  monthCache = {};
  renderCalendar();
  renderTasks();
});

/* ========================================
   TOAST NOTIFICATION
======================================== */
function showToast(msg, type) {
  type = type || 'info';
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = `<i class="fa-solid ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i>${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
/* ========================================
   NOTIFIKASI TASK (HP & PC)
======================================== */
let notifiedTasks = new Set(); // biar tidak spam notif yang sama

function requestNotifPermission() {
  if (!('Notification' in window)) {
    showToast('Browser ini tidak support notifikasi', 'error');
    return;
  }
  
  if (Notification.permission === 'granted') {
    updateNotifUI(true);
    return;
  }

  Notification.requestPermission().then(permission => {
    updateNotifUI(permission === 'granted');
    if (permission === 'granted') {
      showToast('Notifikasi aktif! Kamu akan diingatkan saat waktunya.', 'success');
    } else if (permission === 'denied') {
      showToast('Notifikasi diblokir. Aktifkan di pengaturan browser.', 'error');
    }
  });
}

function updateNotifUI(granted) {
  const icon = document.getElementById('notifIcon');
  const label = document.getElementById('notifLabel');
  const btn = document.getElementById('notifBtn');
  if (granted) {
    icon.className = 'fa-solid fa-bell';
    label.textContent = 'Aktif';
    btn.style.color = '#00d4aa';
  } else {
    icon.className = 'fa-solid fa-bell-slash';
    label.textContent = 'Mati';
    btn.style.color = '';
  }
}

function startReminderChecker() {
  // Cek setiap 30 detik
  setInterval(checkTaskReminders, 30000);
  // Juga cek saat pertama kali load
  checkTaskReminders();
}

async function checkTaskReminders() {
  if (!selectedDate) return;
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Hanya cek task hari ini
  if (selectedDate !== todayStr) return;

  const dayTasks = monthCache[selectedDate] || [];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  dayTasks.forEach(task => {
    if (!task.time) return;            // skip yang tidak punya waktu
    if (task.done) return;             // skip yang sudah selesai
    if (notifiedTasks.has(task.id)) return; // skip yang sudah di-notif

    // Cek apakah waktu task = waktu sekarang
    if (task.time === currentTime) {
      notifiedTasks.add(task.id);
      sendNotification(task);
    }
  });
}

function sendNotification(task) {
  const cat = CATEGORY_LABELS[task.category] || 'Lainnya';

  // Notifikasi browser (muncul di luar app)
  if ('Notification' in window && Notification.permission === 'granted') {
    const notif = new Notification(`⏰ ${task.time} — ${cat}`, {
      body: task.text + (task.note ? `\n📋 ${task.note}` : ''),
      icon: 'https://daily-planner-orpin.vercel.app/favicon.ico',
      tag: String(task.id),   // anti-duplikat
      requireInteraction: true // tetap tampil sampai user klik
    });

    // Saat notif diklik → buka tab/buka app
    notif.onclick = () => {
      window.focus();
      selectDate(selectedDate);
      notif.close();
    };
  }

  // Juga tampilkan toast di dalam app sebagai backup
  showToast(`${task.time} — ${task.text}`, 'info');
}

/* ========================================
   INIT
======================================== */
(async function init() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const appContainer = document.getElementById('appContainer');

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  selectedDate = todayKey();

  // ▼▼▼ TAMBAHKAN 2 BARIS INI ▼▼▼
  requestNotifPermission();
  startReminderChecker();
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  try {
    await fetchMonthData();
    setSyncStatus(true);
  } catch {
    setSyncStatus(false);
  }

  renderCalendarSilent();
  renderTasks();
  updateStats();

  loadingOverlay.classList.add('hidden');
  appContainer.style.opacity = '1';
  setTimeout(() => loadingOverlay.remove(), 600);
})();
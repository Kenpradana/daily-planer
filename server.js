const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

/* ========================================
   INISIALISASI
======================================== */
const app = express();
const PORT = process.env.PORT || 3000;

// Pastikan folder data ada
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const dbPath = path.join(dataDir, 'planner.db');

let db;

/* ========================================
   INISIALISASI DATABASE (async karena sql.js load WASM)
======================================== */
async function initDatabase() {
  const SQL = await initSqlJs();

  // Buka file DB jika sudah ada, buat baru jika belum
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Buat tabel jika belum ada
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date_key   TEXT    NOT NULL,
      text       TEXT    NOT NULL,
      time       TEXT    DEFAULT '',
      note       TEXT    DEFAULT '',
      category   TEXT    DEFAULT 'other',
      done       INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT ''
    )
  `);

  // Buat index untuk performa query
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date_key)`);

  console.log('  Database siap:', dbPath);
}

// Helper: simpan perubahan DB ke file
function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/* ========================================
   MIDDLEWARE
======================================== */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ========================================
   API ROUTES
======================================== */

// --- Ambil tugas per tanggal ---
app.get('/api/tasks', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Parameter date wajib (format YYYY-MM-DD)' });

  const results = db.exec(
    'SELECT * FROM tasks WHERE date_key = ? ORDER BY done ASC, time ASC, id ASC',
    [date]
  );

  const rows = results.length > 0
    ? results[0].values.map(r => ({
        id: r[0], date_key: r[1], text: r[2], time: r[3],
        note: r[4], category: r[5], done: r[6], created_at: r[7]
      }))
    : [];

  res.json(rows);
});

// --- Ambil tugas dalam 1 bulan (untuk dot indicator) ---
app.get('/api/tasks/month', (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'Parameter year & month wajib' });

  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const results = db.exec(
    'SELECT id, date_key, done FROM tasks WHERE date_key LIKE ?',
    [prefix + '%']
  );

  const rows = results.length > 0
    ? results[0].values.map(r => ({ id: r[0], date_key: r[1], done: r[2] }))
    : [];

  res.json(rows);
});

// --- Statistik global ---
app.get('/api/tasks/stats', (req, res) => {
  const totalResult = db.exec('SELECT COUNT(*) FROM tasks');
  const doneResult = db.exec('SELECT COUNT(*) FROM tasks WHERE done = 1');

  const total = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;
  const done = doneResult.length > 0 ? doneResult[0].values[0][0] : 0;

  res.json({ total, done });
});

// --- Tambah tugas baru ---
app.post('/api/tasks', (req, res) => {
  const { date_key, text, time, note, category } = req.body;

  if (!date_key || !text || !text.trim()) {
    return res.status(400).json({ error: 'date_key dan text wajib diisi' });
  }

  const now = new Date();
  const createdAt = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');

  db.run(
    'INSERT INTO tasks (date_key, text, time, note, category, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [date_key, text.trim(), time || '', note || '', category || 'other', createdAt]
  );

  // Ambil row yang baru di-insert
  const results = db.exec(
    'SELECT * FROM tasks WHERE rowid = last_insert_rowid()'
  );

  if (results.length > 0) {
    const r = results[0].values[0];
    const newRow = {
      id: r[0], date_key: r[1], text: r[2], time: r[3],
      note: r[4], category: r[5], done: r[6], created_at: r[7]
    };
    saveDb();
    res.status(201).json(newRow);
  } else {
    res.status(500).json({ error: 'Gagal mengambil data setelah insert' });
  }
});

// --- Update tugas (toggle done, edit dll) ---
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { done, text, time, note, category } = req.body;

  // Cek apakah tugas ada
  const check = db.exec('SELECT id FROM tasks WHERE id = ?', [Number(id)]);
  if (check.length === 0) return res.status(404).json({ error: 'Tugas tidak ditemukan' });

  // Build query dinamis berdasarkan field yang dikirim
  const sets = [];
  const params = [];

  if (text !== undefined) { sets.push('text = ?'); params.push(text.trim()); }
  if (time !== undefined) { sets.push('time = ?'); params.push(time); }
  if (note !== undefined) { sets.push('note = ?'); params.push(note); }
  if (category !== undefined) { sets.push('category = ?'); params.push(category); }
  if (done !== undefined) { sets.push('done = ?'); params.push(done ? 1 : 0); }

  if (sets.length === 0) return res.status(400).json({ error: 'Tidak ada field yang diupdate' });

  params.push(Number(id));
  db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, params);

  // Ambil data yang sudah diupdate
  const results = db.exec('SELECT * FROM tasks WHERE id = ?', [Number(id)]);
  if (results.length > 0) {
    const r = results[0].values[0];
    const updated = {
      id: r[0], date_key: r[1], text: r[2], time: r[3],
      note: r[4], category: r[5], done: r[6], created_at: r[7]
    };
    saveDb();
    res.json(updated);
  } else {
    res.status(500).json({ error: 'Gagal mengambil data setelah update' });
  }
});

// --- Hapus tugas ---
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;

  const check = db.exec('SELECT id FROM tasks WHERE id = ?', [Number(id)]);
  if (check.length === 0) return res.status(404).json({ error: 'Tugas tidak ditemukan' });

  db.run('DELETE FROM tasks WHERE id = ?', [Number(id)]);
  saveDb();
  res.json({ message: 'Tugas dihapus', id: Number(id) });
});

/* ========================================
   FALLBACK: kirim index.html
======================================== */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ========================================
   JALANKAN SERVER
======================================= */
async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║   Daily Planner Server Aktif         ║
  ║   http://localhost:${PORT}             ║
  ║   Database: data/planner.db          ║
  ╚══════════════════════════════════════╝
    `);
  });
}

start().catch(err => {
  console.error('Gagal start server:', err);
  process.exit(1);
});

// Simpan DB saat server mati dengan aman
process.on('SIGINT', () => {
  console.log('\nMenyimpan database...');
  if (db) saveDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (db) saveDb();
  process.exit(0);
});
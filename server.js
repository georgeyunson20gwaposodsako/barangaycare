// BarangayCare server: serves the website and the API, and stores data in database/barangaycare.db (SQLite).
// Needs Node.js 22.5 or newer. No npm install needed.  Run:  node server.js
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'database', 'barangaycare.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE;');
db.exec(fs.readFileSync(path.join(ROOT, 'database', 'schema.sql'), 'utf8'));
// Upgrade existing databases safely.
try { db.exec('ALTER TABLE appointments ADD COLUMN called INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE appointments ADD COLUMN called_at TEXT'); } catch {}
db.exec(`CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'info', read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(username, id)');

// ---------- passwords ----------
const hashPw = pw => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); };
const checkPw = (pw, stored) => { const [salt, h] = String(stored).split(':'); if (!salt || !h) return false;
  const a = crypto.scryptSync(pw, salt, 32), b = Buffer.from(h, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };

// No demo accounts or sample records are created automatically.
// Create the first administrator with: node create-admin.js

// ---------- helpers ----------
const sessions = new Map();               // token -> { username, fullName, role }
const KEYS = ['residents', 'appointments', 'emergencies'];
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const newId = () => Date.now() + Math.floor(Math.random() * 1000);
class HttpError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

const toClient = {
  residents: r => ({ id: r.id, username: r.username, name: r.name, age: r.age == null ? '' : String(r.age), contact: r.contact, address: r.address }),
  appointments: r => ({ id: r.id, queue: r.queue_no, username: r.username, resident: r.resident, service: r.service, date: r.appt_date, status: r.status, notes: r.notes, called: !!r.called }),
  emergencies: r => ({ id: r.id, username: r.username, reporter: r.reporter, type: r.type, location: r.location, priority: r.priority, details: r.details, status: r.status, date: r.reported_at }),
};
const visible = (key, admin, me) => admin ? db.prepare(`SELECT * FROM ${key} ORDER BY id`).all() : db.prepare(`SELECT * FROM ${key} WHERE username = ? ORDER BY id`).all(me);

function saveRows(key, rows, user) {
  const admin = user.role === 'admin', me = user.username;
  const existing = new Map(visible(key, admin, me).map(r => [r.id, r]));
  const seen = new Set();
  const APPT = ['Pending', 'Approved', 'Completed', 'Rejected', 'Cancelled'];
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const id = Number(row.id); if (!Number.isSafeInteger(id) || id <= 0) continue;
      seen.add(id); const old = existing.get(id);
      if (key === 'residents') {
        const name = clip(row.name, 120); if (!name) continue;
        const age = row.age === '' || row.age == null ? null : Math.max(0, Math.min(120, parseInt(row.age, 10) || 0));
        if (old) {
          db.prepare('UPDATE residents SET name=?, age=?, contact=?, address=? WHERE id=?').run(name, age, clip(row.contact, 40), clip(row.address, 160), id);
          if (old.username) {
            db.prepare('UPDATE users SET full_name=? WHERE username=?').run(name, old.username);
            db.prepare('UPDATE appointments SET resident=? WHERE username=?').run(name, old.username);
            if (old.username === me) user.fullName = name;
          }
        } else if (admin || existing.size === 0) {
          db.prepare('INSERT INTO residents (id,username,name,age,contact,address) VALUES (?,?,?,?,?,?)').run(id, admin ? null : me, name, age, clip(row.contact, 40), clip(row.address, 160));
        }
      } else if (key === 'appointments') {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(row.date || '') ? row.date : null;
        if (old) {
          if (admin) {
            const nextStatus = oneOf(row.status, APPT, old.status);
            let queueNo = old.queue_no;
            if (nextStatus === 'Approved' && old.status !== 'Approved' && !queueNo) queueNo = db.prepare('SELECT COALESCE(MAX(queue_no),0)+1 q FROM appointments').get().q;
            db.prepare('UPDATE appointments SET resident=?, service=?, appt_date=?, status=?, notes=?, queue_no=? WHERE id=?')
              .run(clip(row.resident ?? old.resident, 120), clip(row.service ?? old.service, 80), date || old.appt_date, nextStatus, clip(row.notes, 255), queueNo, id);
            if (nextStatus !== old.status) db.prepare('INSERT INTO notifications(username,title,message,kind) VALUES(?,?,?,?)').run(old.username, nextStatus === 'Approved' ? 'Appointment approved' : 'Appointment updated', nextStatus === 'Approved' ? `Your ${old.service} appointment is approved. Your queue ticket is ${queueNo}.` : `Your ${old.service} appointment status is now ${nextStatus}.`, 'appointment');
          }
          else if (old.status === 'Pending') db.prepare('UPDATE appointments SET service=?, appt_date=?, notes=?, status=? WHERE id=?')
            .run(clip(row.service ?? old.service, 80), date || old.appt_date, clip(row.notes, 255), row.status === 'Cancelled' ? 'Cancelled' : 'Pending', id);
          else if (old.status === 'Approved' && row.status === 'Cancelled') db.prepare("UPDATE appointments SET status='Cancelled' WHERE id=?").run(id);
        } else if (date && clip(row.service, 80)) {
          const initialStatus = admin ? oneOf(row.status, APPT, 'Pending') : 'Pending';
          const queue = initialStatus === 'Approved' ? db.prepare('SELECT COALESCE(MAX(queue_no),0)+1 q FROM appointments').get().q : 0;
          db.prepare('INSERT INTO appointments (id,queue_no,username,resident,service,appt_date,status,notes) VALUES (?,?,?,?,?,?,?,?)')
            .run(id, queue, admin ? clip(row.username || me, 50) : me, clip(row.resident || user.fullName, 120), clip(row.service, 80), date, initialStatus, clip(row.notes, 255));
        }
      } else {
        if (old) { if (admin) db.prepare('UPDATE emergencies SET status=? WHERE id=?').run(oneOf(row.status, ['Recorded', 'In progress', 'Resolved'], old.status), id); }
        else if (clip(row.reporter, 120)) db.prepare('INSERT INTO emergencies (id,username,reporter,type,location,priority,details,status,reported_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(id, me, clip(row.reporter, 120), clip(row.type, 60), clip(row.location, 160), oneOf(row.priority, ['Normal', 'High', 'Urgent'], 'Normal'), clip(row.details, 2000), 'Recorded', new Date().toISOString());
      }
    }
    if (admin) for (const id of existing.keys()) if (!seen.has(id)) db.prepare(`DELETE FROM ${key} WHERE id=?`).run(id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

function handleApi(action, body, user, setUser) {
  if (action === 'login') {
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(clip(body.username, 50));
    if (!u || !checkPw(String(body.password || ''), u.password_hash)) throw new HttpError('Incorrect username or password. Please try again.', 401);
    return { user: setUser({ username: u.username, fullName: u.full_name, role: u.role }) };
  }
  if (action === 'register') {
    const username = clip(body.username, 50), full = clip(body.fullName, 120), pass = String(body.password || '');
    if (username.length < 3) throw new HttpError('Username must be at least 3 characters.');
    if (pass.length < 6) throw new HttpError('Password must be at least 6 characters.');
    if (!full) throw new HttpError('Please enter your full name.');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError('That username is already taken.');
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO users (username,password_hash,full_name,role) VALUES (?,?,?,?)').run(username, hashPw(pass), full, 'resident');
      db.prepare('INSERT INTO residents (id,username,name) VALUES (?,?,?)').run(newId(), username, full);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return { user: setUser({ username, fullName: full, role: 'resident' }) };
  }
  if (action === 'logout') { setUser(null); return { ok: true }; }
  if (!user) throw new HttpError('Not signed in.', 401);
  if (action === 'me') return { user };
  const admin = user.role === 'admin';
  if (action === 'load') return { data: Object.fromEntries(KEYS.map(k => [k, visible(k, admin, user.username).map(toClient[k])])) };
  if (action === 'notifications') {
    const rows = db.prepare('SELECT * FROM notifications WHERE username=? ORDER BY id DESC LIMIT 30').all(user.username);
    return { notifications: rows.map(n => ({ id:n.id, title:n.title, message:n.message, kind:n.kind, read:!!n.read_at, createdAt:n.created_at })) };
  }
  if (action === 'read-notifications') { db.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE username=? AND read_at IS NULL').run(user.username); return { ok:true }; }
  if (action === 'call-next') {
    if (!admin) throw new HttpError('Only administrators can call the next resident.',403);
    const next = db.prepare("SELECT * FROM appointments WHERE status='Approved' AND called=0 AND queue_no>0 AND appt_date<=? ORDER BY appt_date, queue_no LIMIT 1").get(new Date().toISOString().slice(0,10));
    if (!next) throw new HttpError('There are no approved residents waiting in the queue.');
    db.prepare('UPDATE appointments SET called=1, called_at=CURRENT_TIMESTAMP WHERE id=?').run(next.id);
    db.prepare('INSERT INTO notifications(username,title,message,kind) VALUES(?,?,?,?)').run(next.username,'It is your turn!',`Please proceed to the health center. Your ticket is #${next.queue_no} for ${next.service}.`,'turn');
    return { ok:true, resident:next.resident, queue:next.queue_no, service:next.service };
  }
  if (action === 'save') {
    if (!KEYS.includes(body.key) || !Array.isArray(body.rows)) throw new HttpError('Bad request.');
    try { saveRows(body.key, body.rows, user); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError('Could not save: ' + e.message, 500); }
    return { rows: visible(body.key, admin, user.username).map(toClient[body.key]) };
  }
  throw new HttpError('Unknown action.', 404);
}

// ---------- web server ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const BLOCKED = ['/database', '/server.js', '/start.bat', '/node_modules'];

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]));
  const token = cookies.bc_session;
  if (url.pathname === '/api') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on('end', () => {
      const send = (code, obj, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...extra }); res.end(JSON.stringify(obj)); };
      let cookieHeader;
      const setUser = u => {
        if (token) sessions.delete(token);
        if (!u) { cookieHeader = 'bc_session=; Path=/; Max-Age=0'; return null; }
        const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, u);
        cookieHeader = `bc_session=${t}; Path=/; HttpOnly; SameSite=Lax`; return u;
      };
      try {
        const body = raw ? JSON.parse(raw) : {};
        const out = handleApi(url.searchParams.get('action'), body, sessions.get(token), setUser);
        send(200, out, cookieHeader ? { 'Set-Cookie': cookieHeader } : {});
      } catch (e) { send(e.code || 400, { error: e.code ? e.message : 'Bad request.' }); }
    });
    return;
  }
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || BLOCKED.some(b => p.toLowerCase().startsWith(b))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' }); res.end(data);
  });
}).listen(PORT, () => console.log(`BarangayCare is running:  http://localhost:${PORT}\nDatabase file: ${DB_FILE}\n(press Ctrl+C to stop)`));

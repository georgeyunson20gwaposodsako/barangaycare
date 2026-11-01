// Create an administrator account directly in SQLite (not in browser storage).
// Usage: node create-admin.js <username> <password> "Full Name"
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const [username, password, fullName] = process.argv.slice(2);
if (!username || !password || !fullName) {
  console.error('Usage: node create-admin.js <username> <password> "Full Name"');
  process.exit(1);
}
if (username.trim().length < 3 || password.length < 8 || !fullName.trim()) {
  console.error('Username must be at least 3 characters, password at least 8 characters, and full name is required.');
  process.exit(1);
}
const db = new DatabaseSync(path.join(__dirname, 'database', 'barangaycare.db'));
const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
if (exists) { console.error('That username already exists.'); process.exit(1); }
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 32).toString('hex');
db.prepare('INSERT INTO users (username,password_hash,full_name,role) VALUES (?,?,?,?)')
  .run(username.trim(), `${salt}:${hash}`, fullName.trim(), 'admin');
console.log(`Administrator account created for ${fullName.trim()} (@${username.trim()}).`);
db.close();

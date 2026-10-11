const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data/team.json');
const SEED = path.join(__dirname, 'data/team_seed.json');
const USERS = path.join(__dirname, 'data/users.json');
const VALID = ['Available', 'Busy', 'Away'];
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-change-this-secret';
const TOKEN_TTL = '2h';

app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function readJson(file, fallback = []) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
function readTeam() { return readJson(DATA, readJson(SEED, [])); }
function readUsers() { return readJson(USERS, []); }
function safeUser(user) { return { id: user.id, name: user.name, email: user.email }; }
function createToken(user) {
  return jwt.sign({ sub: String(user.id), email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000,
    path: '/'
  });
}
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = req.cookies.token || bearer;
  if (!token) return res.status(401).json({ error: 'Authentication required. Register/login and send the token.' });
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    const user = readUsers().find(u => String(u.id) === String(claims.sub));
    if (!user) return res.status(401).json({ error: 'Account not found. Please log in again.' });
    req.user = safeUser(user);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Authentication
app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const users = readUsers();
    if (users.some(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = { id: Date.now(), name, email, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() };
    users.push(user);
    writeJson(USERS, users);
    const token = createToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ message: 'Registration successful.', user: safeUser(user), token, tokenType: 'Bearer', expiresIn: TOKEN_TTL });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Unable to register right now.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = readUsers().find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = createToken(user);
    setAuthCookie(res, token);
    res.json({ message: 'Login successful.', user: safeUser(user), token, tokenType: 'Bearer', expiresIn: TOKEN_TTL });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Unable to log in right now.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  res.json({ message: 'Logged out successfully.' });
});
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

// Read-only dashboard data remains public; all modifying routes require a valid JWT.
app.get('/api/team', (req, res) => {
  try {
    let members = readTeam();
    const status = req.query.status, role = req.query.role, search = String(req.query.search || '').toLowerCase();
    if (status && status !== 'All') members = members.filter(m => m.status === status);
    if (role && role !== 'All') members = members.filter(m => m.role === role);
    if (search) members = members.filter(m => `${m.name} ${m.role} ${m.timezone}`.toLowerCase().includes(search));
    res.json({ count: members.length, members });
  } catch (err) { res.status(500).json({ error: 'Unable to read team data.' }); }
});

app.patch('/api/team/:id/status', requireAuth, (req, res) => {
  try {
    const { status } = req.body || {};
    if (!VALID.includes(status)) return res.status(400).json({ error: 'Status must be Available, Busy, or Away.' });
    const members = readTeam();
    const member = members.find(m => m.id === Number(req.params.id));
    if (!member) return res.status(404).json({ error: 'Team member not found.' });
    member.status = status; member.updatedAt = new Date().toISOString();
    writeJson(DATA, members);
    res.json({ member, message: 'Status updated.' });
  } catch (_) { res.status(500).json({ error: 'Unable to update status.' }); }
});
app.post('/api/team', requireAuth, (req, res) => {
  const { name, role, status = 'Available', timezone = 'Asia/Kolkata' } = req.body || {};
  if (!String(name || '').trim() || !String(role || '').trim()) return res.status(400).json({ error: 'Name and role are required.' });
  if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const members = readTeam();
  const member = { id: Math.max(0, ...members.map(m => m.id)) + 1, name: String(name).trim(), role: String(role).trim(), status, timezone: String(timezone).trim() };
  members.push(member); writeJson(DATA, members);
  res.status(201).json({ member });
});
app.delete('/api/team/:id', requireAuth, (req, res) => {
  const members = readTeam(), filtered = members.filter(m => m.id !== Number(req.params.id));
  if (members.length === filtered.length) return res.status(404).json({ error: 'Team member not found.' });
  writeJson(DATA, filtered); res.json({ message: 'Deleted.' });
});
app.post('/api/team/reset', requireAuth, (_, res) => {
  const members = JSON.parse(fs.readFileSync(SEED, 'utf8')); writeJson(DATA, members);
  res.json({ message: 'Seed data restored.', count: members.length });
});

app.get('/{*splat}', (req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(__dirname, 'public/index.html')));
app.listen(PORT, () => console.log(`Team Availability Tracker running on port ${PORT}`));

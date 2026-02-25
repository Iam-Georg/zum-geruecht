require('dotenv').config();
const express = require('express');
const sharp   = require('sharp');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
app.set('trust proxy', 1); // Railway/Cloudflare Proxy vertrauen
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Security Headers ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Admin-JS nur für eingeloggte Nutzer ausliefern ──────────────────────────
// admin-loader.js ist public (enthält Login-Logik), alle anderen admin-*.js
// werden erst nach erfolgreicher Authentifizierung ausgeliefert.
app.get(/^\/js\/admin-(?!loader).*\.js$/, requireAuth, (_req, _res, next) => next());

// Statische Dateien aus /public ausliefern
// ── WebP Middleware: liefert .webp wenn vorhanden, Browser unterstützt es ──
app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return next();

  // Prüfen ob Browser WebP unterstützt
  const accept = req.headers.accept || '';
  if (!accept.includes('image/webp')) return next();

  // Prüfen ob .webp Version existiert
  const webpPath = path.join(__dirname, 'public',
    req.path.replace(/\.[^.]+$/, '.webp'));
  if (fs.existsSync(webpPath)) {
    res.set('Content-Type', 'image/webp');
    return res.sendFile(webpPath);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Clean URLs – explizite Routen ───────────────────────────────────────────
const cleanUrlPages = [
  'speisekarte','termine','reservierungsanfrage','mediathek',
  'geschichte','jobs','anfahrt','impressum','datenschutz'
];

// /anfrage existiert nicht – Redirect auf reservierungsanfrage
app.get('/anfrage', (req, res) => res.redirect(301, '/reservierungsanfrage'));

cleanUrlPages.forEach(page => {
  app.get('/' + page, (req, res) => {
    const htmlPath = path.join(__dirname, 'public', page + '.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Seite nicht gefunden – Zum Gerücht</title>
  <link href="/css/bootstrap.css" rel="stylesheet">
  <link href="/css/zum-geruecht.css" rel="stylesheet">
  <style>
    .error-box { text-align:center; padding:60px 20px; }
    .error-box h1 { color:#b38c0f; font-size:5em; margin-bottom:10px; }
    .error-box h2 { color:#c4b47a; margin-bottom:20px; }
    .error-box p  { color:#a19d91; font-size:1.2em; margin-bottom:30px; }
    .error-box a  { color:#b38c0f; text-decoration:none; border:1px solid #604e14; padding:10px 24px; border-radius:5px; }
    .error-box a:hover { border-color:#b38c0f; color:#ebebeb; }
  </style>
</head>
<body>
  <div class="container">
    <div id="wrapper"><div id="wrapper-box"><div id="wrapper-content-box">
      <div class="error-box">
        <h1>404</h1>
        <h2>~ Diese Seite existiert nicht ~</h2>
        <p>Vielleicht wurde sie umgezogen oder der Link ist veraltet.</p>
        <a href="/">~ Zurück zur Startseite ~</a>
      </div>
    </div></div></div>
  </div>
</body>
</html>`);
    }
  });
});

// Uploads-Ordner erstellen falls nicht vorhanden
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── Multer – Bild Upload Konfiguration ──────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Zielordner aus Form-Feld 'folder' – Fallback: uploads
    const raw     = (req.body.folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeDir = raw || 'uploads';
    const destDir = path.resolve(path.join(__dirname, 'public', safeDir));

    // Path-Traversal-Schutz
    if (!destDir.startsWith(path.resolve(path.join(__dirname, 'public')))) {
      return cb(new Error('Ungültiger Zielordner'));
    }
    // Ordner anlegen falls nötig (z.B. neu erstellte Custom-Ordner)
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const raw     = (req.body.folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeDir = raw || 'uploads';
    const destDir = path.join(__dirname, 'public', safeDir);

    // Originalnamen behalten, aber Sonderzeichen entfernen
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase();
    // Wenn Datei schon existiert, Timestamp voranstellen
    const finalName = fs.existsSync(path.join(destDir, safeName))
      ? `${Date.now()}_${safeName}`
      : safeName;
    cb(null, finalName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Nur Bilder erlaubt (jpg, png, gif, webp)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15 MB max
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies.admin_token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

// ─── ROUTEN ──────────────────────────────────────────────────────────────────

// ─── Brute-Force-Schutz für Login ────────────────────────────────────────────
// Kein externes Paket nötig – simples In-Memory Map pro IP
const loginAttempts = new Map(); // ip → { count, blockedUntil }
const MAX_ATTEMPTS   = 3;               // max. Fehlversuche
const BLOCK_DURATION = 15 * 60 * 1000; // 15 Minuten Sperre in ms

function getClientIP(req) {
  return req.ip || req.socket.remoteAddress;
}

function isBlocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (entry.blockedUntil && Date.now() < entry.blockedUntil) return true;
  // Sperre abgelaufen → zurücksetzen
  if (entry.blockedUntil && Date.now() >= entry.blockedUntil) {
    loginAttempts.delete(ip);
  }
  return false;
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: null };
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_DURATION;
    console.warn(`[Sicherheit] IP ${ip} nach ${MAX_ATTEMPTS} Fehlversuchen für 15 Min gesperrt.`);
  }
  loginAttempts.set(ip, entry);
}

function recordSuccessfulLogin(ip) {
  loginAttempts.delete(ip); // Zähler bei Erfolg zurücksetzen
}

// Alte Einträge stündlich aufräumen (Speicher nicht vollaufen lassen)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (!entry.blockedUntil || now >= entry.blockedUntil) {
      loginAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000);

// POST /api/login – Admin Login
app.post('/api/login', async (req, res) => {
  const ip = getClientIP(req);

  // Gesperrte IP ablehnen
  if (isBlocked(ip)) {
    const entry = loginAttempts.get(ip);
    const remainingMs = entry.blockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return res.status(429).json({
      error: `Zu viele Fehlversuche. Bitte ${remainingMin} Minute(n) warten.`
    });
  }

  const { password } = req.body;

  const isMatch = password ? await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH) : false;

  if (!isMatch) {
    recordFailedAttempt(ip);
    const entry = loginAttempts.get(ip);
    const remaining = MAX_ATTEMPTS - entry.count;

    if (remaining <= 0) {
      return res.status(429).json({
        error: `Zu viele Fehlversuche. Bitte 15 Minuten warten.`
      });
    }

    return res.status(401).json({
      error: `Falsches Passwort. Noch ${remaining} Versuch(e) übrig.`
    });
  }

  // Erfolgreich – Zähler zurücksetzen
  recordSuccessfulLogin(ip);

  const token = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: 'strict'
  });

  res.json({ success: true, message: 'Eingeloggt' });
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// GET /api/check-auth – Prüft ob Token noch gültig ist
app.get('/api/check-auth', requireAuth, (req, res) => {
  res.json({ authenticated: true });
});

// POST /api/save-html – HTML einer Seite speichern
app.post('/api/save-html', requireAuth, (req, res) => {
  const { filename, content } = req.body;

  // Sicherheitscheck: Nur HTML-Dateien in /public erlauben
  if (!filename || !filename.endsWith('.html')) {
    return res.status(400).json({ error: 'Ungültiger Dateiname' });
  }

  // Path Traversal verhindern
  const targetPath = path.resolve(path.join(__dirname, 'public', filename));
  const publicDir = path.resolve(path.join(__dirname, 'public'));

  if (!targetPath.startsWith(publicDir)) {
    return res.status(403).json({ error: 'Zugriff verweigert' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Datei nicht gefunden' });
  }

  // Backup erstellen vor dem Speichern
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  const backupName = `${filename.replace('.html', '')}_${Date.now()}.html`;
  fs.copyFileSync(targetPath, path.join(backupDir, backupName));

  // Alte Backups aufräumen – max. 10 pro Seite
  const baseName = filename.replace('.html', '');
  const allBackups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith(baseName + '_') && f.endsWith('.html'))
    .sort();
  if (allBackups.length > 10) {
    allBackups.slice(0, allBackups.length - 10).forEach(old => {
      fs.unlinkSync(path.join(backupDir, old));
    });
  }

  // Datei speichern
  try {
    fs.writeFileSync(targetPath, content, 'utf8');

    // ── Sitemap lastmod aktualisieren ──────────────────────────────────────────
    updateSitemapLastmod(filename);

    res.json({ success: true, message: `${filename} gespeichert` });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Speichern: ' + err.message });
  }
});

// Sitemap lastmod für die gespeicherte Seite aktualisieren
function updateSitemapLastmod(filename) {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return;

  // URL-Pfad aus Dateiname ableiten (Clean URL: ohne .html)
  const urlPath = filename === 'index.html' ? '/' : '/' + filename.replace(/\.html$/, '');
  const today   = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    let xml = fs.readFileSync(sitemapPath, 'utf8');

    // lastmod für die passende URL ersetzen
    // Sucht: <loc>...urlPath</loc> dann die folgende <lastmod>...</lastmod>
    const escaped = urlPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp(
      `(<loc>[^<]*${escaped}</loc>\\s*<lastmod>)[^<]*(</lastmod>)`, 'g'
    );

    if (regex.test(xml)) {
      xml = xml.replace(regex, `$1${today}$2`);
      fs.writeFileSync(sitemapPath, xml, 'utf8');
      console.log(`📅 sitemap.xml: ${urlPath} → lastmod ${today}`);
    }
  } catch (err) {
    console.error('Sitemap-Update fehlgeschlagen:', err.message);
    // Kein fataler Fehler – Hauptspeicherung war bereits erfolgreich
  }
}

// POST /api/upload-image – Bild hochladen + automatisch zu WebP konvertieren
app.post('/api/upload-image', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Kein Bild empfangen' });
  }

  // Zielordner aus Form-Feld (Multer hat schon dorthin geschrieben)
  const targetFolder = (req.body.folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
  const targetDir    = path.join(__dirname, 'public', targetFolder);

  const originalPath = req.file.path;
  const originalName = req.file.filename;
  const ext          = path.extname(originalName).toLowerCase();

  // Nur konvertieren wenn kein WebP (GIFs auch überspringen – Animation)
  if (ext === '.webp' || ext === '.gif') {
    const imageUrl = `/${targetFolder}/${originalName}`;
    return res.json({ success: true, url: imageUrl, filename: originalName,
      folder: targetFolder, originalName: req.file.originalname, size: req.file.size });
  }

  try {
    // WebP-Dateiname: gleicher Name, andere Endung
    const webpName = originalName.replace(/\.[^.]+$/, '.webp');
    const webpPath = path.join(targetDir, webpName);

    await sharp(originalPath)
      .webp({ quality: 82 })
      .toFile(webpPath);

    // Original löschen – WebP ist das neue Original
    fs.unlinkSync(originalPath);

    const size     = fs.statSync(webpPath).size;
    const imageUrl = `/${targetFolder}/${webpName}`;

    res.json({ success: true, url: imageUrl, filename: webpName,
      folder: targetFolder, originalName: req.file.originalname, size });

  } catch (err) {
    // Konvertierung fehlgeschlagen → Original behalten
    console.error('WebP-Konvertierung fehlgeschlagen:', err.message);
    const imageUrl = `/${targetFolder}/${originalName}`;
    res.json({ success: true, url: imageUrl, filename: originalName,
      folder: targetFolder, originalName: req.file.originalname, size: req.file.size });
  }
});

// GET /api/images – Alle verfügbaren Bilder auflisten (nur .webp, dynamische Ordner)
app.get('/api/images', requireAuth, (req, res) => {
  const publicDir = path.join(__dirname, 'public');
  const allImages = [];
  const folders   = [];

  // Verzeichnisse die keine Bild-Ordner sind
  const EXCLUDE = new Set(['css', 'js', 'fonts', 'vendor', 'node_modules',
                            'images', 'bilder-kneipe']); // werden separat unten gehandelt

  // 1. uploads – immer einschließen (auch wenn leer, ist Upload-Ziel)
  if (fs.existsSync(UPLOADS_DIR)) {
    folders.push('uploads');
    fs.readdirSync(UPLOADS_DIR)
      .filter(f => path.extname(f).toLowerCase() === '.webp')
      .forEach(f => allImages.push({ url: `/uploads/${f}`, folder: 'uploads', name: f }));
  }

  // 2. /public/images – statische Seiten-Bilder
  const imagesDir = path.join(publicDir, 'images');
  if (fs.existsSync(imagesDir)) {
    const webps = fs.readdirSync(imagesDir)
      .filter(f => path.extname(f).toLowerCase() === '.webp');
    if (webps.length) {
      folders.push('images');
      webps.forEach(f => allImages.push({ url: `/images/${f}`, folder: 'images', name: f }));
    }
  }

  // 3. /public/bilder-kneipe
  const bilderDir = path.join(publicDir, 'bilder-kneipe');
  if (fs.existsSync(bilderDir)) {
    const webps = fs.readdirSync(bilderDir)
      .filter(f => path.extname(f).toLowerCase() === '.webp');
    if (webps.length) {
      folders.push('bilder-kneipe');
      webps.forEach(f => allImages.push({ url: `/bilder-kneipe/${f}`, folder: 'bilder-kneipe', name: f }));
    }
  }

  // 4. Alle anderen Unterverzeichnisse dynamisch scannen (z.B. galerie_*, custom-Ordner)
  try {
    fs.readdirSync(publicDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !EXCLUDE.has(d.name) && d.name !== 'uploads')
      .forEach(d => {
        const dir  = path.join(publicDir, d.name);
        const webps = fs.readdirSync(dir)
          .filter(f => path.extname(f).toLowerCase() === '.webp');
        if (webps.length) {
          folders.push(d.name);
          webps.forEach(f => allImages.push({ url: `/${d.name}/${f}`, folder: d.name, name: f }));
        }
      });
  } catch (err) {
    console.error('Ordner-Scan fehlgeschlagen:', err.message);
  }

  res.json({ images: allImages, folders });
});

// PATCH /api/images/uploads/:filename – Bild umbenennen (nur uploads)
app.patch('/api/images/uploads/:filename', requireAuth, (req, res) => {
  const { filename } = req.params;
  const { newName } = req.body;

  if (!newName) return res.status(400).json({ error: 'Kein neuer Name angegeben' });

  // Sicherheitscheck: Nur einfache Dateinamen erlauben
  const safeName = newName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  const ext = path.extname(filename).toLowerCase();
  const safeNameWithExt = safeName.endsWith(ext) ? safeName : safeName + ext;

  const oldPath = path.resolve(path.join(UPLOADS_DIR, filename));
  const newPath = path.resolve(path.join(UPLOADS_DIR, safeNameWithExt));

  if (!oldPath.startsWith(path.resolve(UPLOADS_DIR))) {
    return res.status(403).json({ error: 'Zugriff verweigert' });
  }
  if (!fs.existsSync(oldPath)) return res.status(404).json({ error: 'Datei nicht gefunden' });
  if (fs.existsSync(newPath) && oldPath !== newPath) {
    return res.status(409).json({ error: 'Dateiname bereits vergeben' });
  }

  fs.renameSync(oldPath, newPath);
  res.json({ success: true, newName: safeNameWithExt, url: `/uploads/${safeNameWithExt}` });
});

// DELETE /api/images/:folder/:filename – Bild löschen (beliebiger Ordner, löscht auch Original)
app.delete('/api/images/:folder/:filename', requireAuth, (req, res) => {
  const { folder, filename } = req.params;

  // Sicherheitscheck: keine Pfadkomponenten
  if ([folder, filename].some(v => v.includes('/') || v.includes('\\') || v.includes('..'))) {
    return res.status(403).json({ error: 'Zugriff verweigert' });
  }

  const publicDir = path.resolve(path.join(__dirname, 'public'));
  const targetDir = path.resolve(path.join(__dirname, 'public', folder));
  if (!targetDir.startsWith(publicDir)) {
    return res.status(403).json({ error: 'Zugriff verweigert' });
  }

  const filePath = path.join(targetDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Datei nicht gefunden' });
  }

  fs.unlinkSync(filePath);

  // Auch Original (jpg/jpeg/png/gif) löschen, falls vorhanden
  const baseName = filename.replace(/\.webp$/i, '');
  for (const ext of ['.jpg', '.jpeg', '.png', '.gif']) {
    const origPath = path.join(targetDir, baseName + ext);
    if (fs.existsSync(origPath)) {
      try { fs.unlinkSync(origPath); } catch {}
    }
  }

  res.json({ success: true });
});

// POST /api/folders – Neuen Bild-Ordner anlegen
app.post('/api/folders', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Kein Name angegeben' });

  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  if (!safeName) return res.status(400).json({ error: 'Ungültiger Ordnername' });

  const publicDir = path.resolve(path.join(__dirname, 'public'));
  const targetDir = path.resolve(path.join(__dirname, 'public', safeName));
  if (!targetDir.startsWith(publicDir)) {
    return res.status(403).json({ error: 'Zugriff verweigert' });
  }
  if (fs.existsSync(targetDir)) {
    return res.status(409).json({ error: 'Ordner existiert bereits' });
  }

  try {
    fs.mkdirSync(targetDir);
    res.json({ success: true, name: safeName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/images/move – Bild in anderen Ordner verschieben
app.post('/api/images/move', requireAuth, (req, res) => {
  const { folder, filename, targetFolder } = req.body;
  if (!folder || !filename || !targetFolder)
    return res.status(400).json({ error: 'Parameter fehlen' });

  if ([folder, filename, targetFolder].some(v => v.includes('/') || v.includes('\\') || v.includes('..')))
    return res.status(403).json({ error: 'Zugriff verweigert' });

  const publicDir = path.resolve(path.join(__dirname, 'public'));
  const srcDir    = path.resolve(path.join(__dirname, 'public', folder));
  const dstDir    = path.resolve(path.join(__dirname, 'public', targetFolder));

  if (!srcDir.startsWith(publicDir) || !dstDir.startsWith(publicDir))
    return res.status(403).json({ error: 'Zugriff verweigert' });

  if (!fs.existsSync(dstDir))
    return res.status(404).json({ error: 'Zielordner existiert nicht' });

  const srcPath = path.join(srcDir, filename);
  const dstPath = path.join(dstDir, filename);

  if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Datei nicht gefunden' });
  if (fs.existsSync(dstPath))  return res.status(409).json({ error: 'Datei existiert bereits im Zielordner' });

  try {
    fs.renameSync(srcPath, dstPath);
    res.json({ success: true, newUrl: `/${targetFolder}/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Fehlerbehandlung ─────────────────────────────────────────────────────────
// POST /api/upload-pdf – Speisekarte als PDF hochladen
const multerPdf = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public')),
    filename:    (req, file, cb) => cb(null, 'speisekarte.pdf')
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Nur PDF-Dateien erlaubt'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.post('/api/upload-pdf', requireAuth, multerPdf.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine PDF-Datei erhalten' });
  const version = Date.now();
  res.json({ success: true, url: `/speisekarte.pdf?v=${version}`, version });
});

// GET /api/backups/:filename – Sicherungen auflisten
app.get('/api/backups/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename;
  if (!filename || !filename.endsWith('.html') || filename.includes('/') || filename.includes('\\'))
    return res.status(400).json({ error: 'Ungültiger Dateiname' });

  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) return res.json({ backups: [] });

  const baseName = filename.replace('.html', '');
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith(baseName + '_') && f.endsWith('.html'))
    .sort().reverse()
    .map(f => {
      const ts = parseInt(f.replace(baseName + '_', '').replace('.html', ''));
      return {
        name: f,
        date: isNaN(ts) ? f : new Date(ts).toLocaleString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      };
    });
  res.json({ backups });
});

// POST /api/restore-backup – Sicherung wiederherstellen
app.post('/api/restore-backup', requireAuth, (req, res) => {
  const { filename, backupName } = req.body;
  if (!filename || !filename.endsWith('.html') || filename.includes('/') ||
      !backupName || !backupName.endsWith('.html') || backupName.includes('/'))
    return res.status(400).json({ error: 'Ungültige Parameter' });

  const backupDir  = path.join(__dirname, 'backups');
  const backupPath = path.resolve(path.join(backupDir, backupName));
  const targetPath = path.resolve(path.join(__dirname, 'public', filename));
  const publicDir  = path.resolve(path.join(__dirname, 'public'));

  if (!targetPath.startsWith(publicDir) || !backupPath.startsWith(path.resolve(backupDir)))
    return res.status(403).json({ error: 'Zugriff verweigert' });
  if (!fs.existsSync(backupPath))
    return res.status(404).json({ error: 'Backup nicht gefunden' });

  try {
    // Aktuellen Stand zuerst sichern
    if (fs.existsSync(targetPath)) {
      const baseName = filename.replace('.html', '');
      const safeName = baseName + '_' + Date.now() + '.html';
      fs.copyFileSync(targetPath, path.join(backupDir, safeName));
      // Max 10 Backups pro Seite
      const all = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(baseName + '_') && f.endsWith('.html')).sort();
      if (all.length > 10) all.slice(0, all.length - 10)
        .forEach(old => fs.unlinkSync(path.join(backupDir, old)));
    }
    fs.copyFileSync(backupPath, targetPath);
    updateSitemapLastmod(filename);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/change-password
app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Felder fehlen' });
  if (!bcrypt.compareSync(currentPassword, process.env.ADMIN_PASSWORD_HASH))
    return res.status(401).json({ error: 'Aktuelles Passwort falsch' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'Neues Passwort zu kurz (min. 8 Zeichen)' });

  const newHash = bcrypt.hashSync(newPassword, 10);
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(/ADMIN_PASSWORD_HASH=.*/, `ADMIN_PASSWORD_HASH=${newHash}`);
  fs.writeFileSync(envPath, envContent, 'utf8');
  process.env.ADMIN_PASSWORD_HASH = newHash;
  res.json({ success: true });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Datei zu groß (max. 15 MB)' });
    }
  }
  console.error(err);
  res.status(500).json({ error: err.message || 'Serverfehler' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ http://localhost:${PORT}`);
});
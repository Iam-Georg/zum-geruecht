require('dotenv').config();
const express = require('express');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({
  limit: '10mb'
}));
app.use(express.urlencoded({
  extended: true
}));
app.use(cookieParser());

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
  'speisekarte', 'termine', 'reservierungsanfrage', 'mediathek',
  'geschichte', 'jobs', 'anfahrt', 'impressum', 'datenschutz'
];

// /anfrage existiert nicht – Redirect auf reservierungsanfrage
app.get('/anfrage', (req, res) => res.redirect(301, '/reservierungsanfrage'));

cleanUrlPages.forEach(page => {
  app.get('/' + page, (req, res) => {
    const htmlPath = path.join(__dirname, 'public', page + '.html');
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send('Seite nicht gefunden');
    }
  });
});

// Uploads-Ordner erstellen falls nicht vorhanden
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, {
    recursive: true
  });
}

// ─── Multer – Bild Upload Konfiguration ──────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Originalnamen behalten, aber Sonderzeichen entfernen
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase();
    // Wenn Datei schon existiert, Timestamp voranstellen
    const finalName = fs.existsSync(path.join(UPLOADS_DIR, safeName)) ?
      `${Date.now()}_${safeName}` :
      safeName;
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
  limits: {
    fileSize: 15 * 1024 * 1024
  } // 15 MB max
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies.admin_token || req.headers['authorization'] ?.split(' ')[1];
  if (!token) return res.status(401).json({
    error: 'Nicht eingeloggt'
  });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Token ungültig oder abgelaufen'
    });
  }
}

// ─── ROUTEN ──────────────────────────────────────────────────────────────────

// ─── Brute-Force-Schutz für Login ────────────────────────────────────────────
// Kein externes Paket nötig – simples In-Memory Map pro IP
const loginAttempts = new Map(); // ip → { count, blockedUntil }
const MAX_ATTEMPTS = 3; // max. Fehlversuche
const BLOCK_DURATION = 15 * 60 * 1000; // 15 Minuten Sperre in ms

function getClientIP(req) {
  return req.headers['x-forwarded-for'] ?.split(',')[0].trim() || req.socket.remoteAddress;
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
  const entry = loginAttempts.get(ip) || {
    count: 0,
    blockedUntil: null
  };
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
app.post('/api/login', (req, res) => {
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

  const {
    password
  } = req.body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
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

  const token = jwt.sign({
      role: 'admin'
    },
    process.env.JWT_SECRET, {
      expiresIn: '8h'
    }
  );

  res.cookie('admin_token', token, {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: 'strict'
  });

  res.json({
    success: true,
    message: 'Eingeloggt'
  });
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({
    success: true
  });
});

// GET /api/check-auth – Prüft ob Token noch gültig ist
app.get('/api/check-auth', requireAuth, (req, res) => {
  res.json({
    authenticated: true
  });
});

// POST /api/save-html – HTML einer Seite speichern
app.post('/api/save-html', requireAuth, (req, res) => {
  const {
    filename,
    content
  } = req.body;

  // Sicherheitscheck: Nur HTML-Dateien in /public erlauben
  if (!filename || !filename.endsWith('.html')) {
    return res.status(400).json({
      error: 'Ungültiger Dateiname'
    });
  }

  // Path Traversal verhindern
  const targetPath = path.resolve(path.join(__dirname, 'public', filename));
  const publicDir = path.resolve(path.join(__dirname, 'public'));

  if (!targetPath.startsWith(publicDir)) {
    return res.status(403).json({
      error: 'Zugriff verweigert'
    });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({
      error: 'Datei nicht gefunden'
    });
  }

  // Backup erstellen vor dem Speichern
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  const backupName = `${filename.replace('.html', '')}_${Date.now()}.html`;
  fs.copyFileSync(targetPath, path.join(backupDir, backupName));

  // Datei speichern
  try {
    fs.writeFileSync(targetPath, content, 'utf8');

    // ── Sitemap lastmod aktualisieren ──────────────────────────────────────────
    updateSitemapLastmod(filename);

    res.json({
      success: true,
      message: `${filename} gespeichert`
    });
  } catch (err) {
    res.status(500).json({
      error: 'Fehler beim Speichern: ' + err.message
    });
  }
});

// Sitemap lastmod für die gespeicherte Seite aktualisieren
function updateSitemapLastmod(filename) {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return;

  // URL-Pfad aus Dateiname ableiten (Clean URL: ohne .html)
  const urlPath = filename === 'index.html' ? '/' : '/' + filename.replace(/\.html$/, '');
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    let xml = fs.readFileSync(sitemapPath, 'utf8');

    // lastmod für die passende URL ersetzen
    // Sucht: <loc>...urlPath</loc> dann die folgende <lastmod>...</lastmod>
    const escaped = urlPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
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
    return res.status(400).json({
      error: 'Kein Bild empfangen'
    });
  }

  const originalPath = req.file.path;
  const originalName = req.file.filename;
  const ext = path.extname(originalName).toLowerCase();

  // Nur konvertieren wenn kein WebP (GIFs auch überspringen – Animation)
  if (ext === '.webp' || ext === '.gif') {
    const imageUrl = `/uploads/${originalName}`;
    return res.json({
      success: true,
      url: imageUrl,
      filename: originalName,
      originalName: req.file.originalname,
      size: req.file.size
    });
  }

  try {
    // WebP-Dateiname: gleicher Name, andere Endung
    const webpName = originalName.replace(/\.[^.]+$/, '.webp');
    const webpPath = path.join(UPLOADS_DIR, webpName);

    await sharp(originalPath)
      .webp({
        quality: 82
      })
      .toFile(webpPath);

    // Original löschen – WebP ist das neue Original
    fs.unlinkSync(originalPath);

    const size = fs.statSync(webpPath).size;
    const imageUrl = `/uploads/${webpName}`;

    res.json({
      success: true,
      url: imageUrl,
      filename: webpName,
      originalName: req.file.originalname,
      size
    });

  } catch (err) {
    // Konvertierung fehlgeschlagen → Original behalten
    console.error('WebP-Konvertierung fehlgeschlagen:', err.message);
    const imageUrl = `/uploads/${originalName}`;
    res.json({
      success: true,
      url: imageUrl,
      filename: originalName,
      originalName: req.file.originalname,
      size: req.file.size
    });
  }
});

// GET /api/images – Alle verfügbaren Bilder auflisten
app.get('/api/images', requireAuth, (req, res) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const allImages = [];

  // Bilder aus /public/uploads
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadFiles = fs.readdirSync(UPLOADS_DIR)
      .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()))
      .map(f => ({
        url: `/uploads/${f}`,
        folder: 'uploads',
        name: f
      }));
    allImages.push(...uploadFiles);
  }

  // Bilder aus /public/images
  const imagesDir = path.join(__dirname, 'public', 'images');
  if (fs.existsSync(imagesDir)) {
    const imageFiles = fs.readdirSync(imagesDir)
      .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()))
      .map(f => ({
        url: `/images/${f}`,
        folder: 'images',
        name: f
      }));
    allImages.push(...imageFiles);
  }

  // Bilder aus /public/bilder-kneipe
  const bilderDir = path.join(__dirname, 'public', 'bilder-kneipe');
  if (fs.existsSync(bilderDir)) {
    const bilderFiles = fs.readdirSync(bilderDir)
      .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()))
      .map(f => ({
        url: `/bilder-kneipe/${f}`,
        folder: 'bilder-kneipe',
        name: f
      }));
    allImages.push(...bilderFiles);
  }

  // Galerie-Ordner
  ['galerie_25_1', 'galerie_25_2', 'galerie_30_1'].forEach(folder => {
    const dir = path.join(__dirname, 'public', folder);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
        .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()))
        .map(f => ({
          url: `/${folder}/${f}`,
          folder,
          name: f
        }));
      allImages.push(...files);
    }
  });

  res.json({
    images: allImages
  });
});

// PATCH /api/images/uploads/:filename – Bild umbenennen (nur uploads)
app.patch('/api/images/uploads/:filename', requireAuth, (req, res) => {
  const {
    filename
  } = req.params;
  const {
    newName
  } = req.body;

  if (!newName) return res.status(400).json({
    error: 'Kein neuer Name angegeben'
  });

  // Sicherheitscheck: Nur einfache Dateinamen erlauben
  const safeName = newName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  const ext = path.extname(filename).toLowerCase();
  const safeNameWithExt = safeName.endsWith(ext) ? safeName : safeName + ext;

  const oldPath = path.resolve(path.join(UPLOADS_DIR, filename));
  const newPath = path.resolve(path.join(UPLOADS_DIR, safeNameWithExt));

  if (!oldPath.startsWith(path.resolve(UPLOADS_DIR))) {
    return res.status(403).json({
      error: 'Zugriff verweigert'
    });
  }
  if (!fs.existsSync(oldPath)) return res.status(404).json({
    error: 'Datei nicht gefunden'
  });
  if (fs.existsSync(newPath) && oldPath !== newPath) {
    return res.status(409).json({
      error: 'Dateiname bereits vergeben'
    });
  }

  fs.renameSync(oldPath, newPath);
  res.json({
    success: true,
    newName: safeNameWithExt,
    url: `/uploads/${safeNameWithExt}`
  });
});

// DELETE /api/images/:folder/:filename – Bild löschen (nur aus uploads)
app.delete('/api/images/uploads/:filename', requireAuth, (req, res) => {
  const {
    filename
  } = req.params;
  const filePath = path.resolve(path.join(UPLOADS_DIR, filename));

  // Sicherheitscheck
  if (!filePath.startsWith(path.resolve(UPLOADS_DIR))) {
    return res.status(403).json({
      error: 'Zugriff verweigert'
    });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: 'Datei nicht gefunden'
    });
  }

  fs.unlinkSync(filePath);
  res.json({
    success: true
  });
});

// ─── Fehlerbehandlung ─────────────────────────────────────────────────────────
// POST /api/change-password
app.post('/api/change-password', requireAuth, (req, res) => {
  const {
    currentPassword,
    newPassword
  } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({
      error: 'Felder fehlen'
    });
  if (currentPassword !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({
      error: 'Aktuelles Passwort falsch'
    });
  if (newPassword.length < 8)
    return res.status(400).json({
      error: 'Neues Passwort zu kurz (min. 8 Zeichen)'
    });

  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(/ADMIN_PASSWORD=.*/, `ADMIN_PASSWORD=${newPassword}`);
  fs.writeFileSync(envPath, envContent, 'utf8');
  process.env.ADMIN_PASSWORD = newPassword;
  res.json({
    success: true
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Datei zu groß (max. 15 MB)'
      });
    }
  }
  console.error(err);
  res.status(500).json({
    error: err.message || 'Serverfehler'
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ http://localhost:${PORT}`);
});
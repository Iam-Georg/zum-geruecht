/**
 * Einmaliges WebP-Konvertier-Skript für bestehende Bilder
 * 
 * Ausführen: node convert-existing-to-webp.js
 * Originale bleiben erhalten – der Server liefert automatisch WebP wenn vorhanden.
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const FOLDERS = [
  'public/images',
  'public/bilder-kneipe',
  'public/uploads',
  'public/galerie_25_1',
  'public/galerie_25_2',
  'public/galerie_30_1',
];

const SKIP = ['logo-zum-geruecht', 'apple-touch', 'favicon', 'footer'];
const QUALITY = 82;

async function convertFolder(folder) {
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) { console.log(`  ⏭  ${folder} nicht gefunden`); return; }

  const files = fs.readdirSync(dir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .filter(f => !SKIP.some(s => f.toLowerCase().includes(s)));

  if (!files.length) { console.log(`  – keine Bilder`); return; }

  let saved = 0;
  for (const file of files) {
    const input   = path.join(dir, file);
    const webpName = file.replace(/\.[^.]+$/, '.webp');
    const output  = path.join(dir, webpName);

    // Bereits konvertiert → überspringen
    if (fs.existsSync(output)) {
      console.log(`  ⏭  ${file} → bereits vorhanden`);
      continue;
    }

    try {
      const before = fs.statSync(input).size;
      await sharp(input).webp({ quality: QUALITY }).toFile(output);
      const after  = fs.statSync(output).size;
      const saving = Math.round((1 - after / before) * 100);
      saved += (before - after);
      console.log(`  ✅ ${file.padEnd(35)} → ${webpName} (${saving}% kleiner)`);
    } catch (err) {
      console.error(`  ❌ ${file}: ${err.message}`);
    }
  }
  return saved;
}

(async () => {
  console.log('🔄 Konvertiere bestehende Bilder zu WebP...\n');
  let totalSaved = 0;
  for (const folder of FOLDERS) {
    console.log(`\n📁 ${folder}`);
    totalSaved += await convertFolder(folder) || 0;
  }
  const mb = (totalSaved / 1024 / 1024).toFixed(1);
  console.log(`\n✅ Fertig! ${mb} MB gespart.`);
  console.log('   Originale bleiben erhalten – Server liefert WebP automatisch.');
  console.log('   Zum Testen: http://localhost:3000/images/bild-speisekarte.webp');
})();
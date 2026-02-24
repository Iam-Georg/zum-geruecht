# Zum Gerücht – CMS & Website Projektübersicht

## Projektzeitraum

Ca. 2 Wochen, täglich ~4 Stunden Entwicklungsarbeit

---

## Technologie-Stack

| Schicht     | Technologie                             |
| ----------- | --------------------------------------- |
| Server      | Node.js + Express                       |
| Auth        | bcrypt + HTTP-only Cookies + JWT        |
| Frontend    | Vanilla JS (kein Framework)             |
| Styling     | Bootstrap 3 + Custom CSS                |
| Bilder      | Sharp (WebP-Konvertierung serverseitig) |
| Drag & Drop | SortableJS (CDN)                        |
| Hosting     | Hetzner (empfohlen)                     |

---

## Dateistruktur

```
/
├── server.js               – Express-Backend, alle API-Routen
├── public/
│   ├── index.html          – Startseite
│   ├── termine.html        – Veranstaltungen
│   ├── speisekarte.html    – Speisekarte
│   ├── mediathek.html      – Fotogalerie
│   ├── anfrage.html        – Reservierungsanfrage
│   ├── impressum.html
│   ├── datenschutz.html
│   ├── js/
│   │   ├── admin-state.js  – Config, globaler State, Scroll-Lock, escHtml
│   │   ├── admin-ui.js     – Admin-Bar, Login, Galerie, Toolbar, Notify, Dialoge
│   │   ├── admin-blocks.js – Block-System, Undo/Save, Termin-System
│   │   └── admin-edit.js   – Entry Point (Initialisierung & Orchestrierung)
│   ├── css/
│   │   ├── zum-geruecht.css
│   │   ├── bootstrap.css
│   │   └── admin-edit.css  – Alle Admin-/CMS-Styles (ausgelagert aus JS)
│   ├── images/             – Statische Bilder
│   └── images/uploads/     – Hochgeladene Bilder (WebP)
├── backups/                – Automatische HTML-Sicherungen (max. 10/Seite)
└── .env                    – ADMIN_PASSWORD_HASH, JWT_SECRET, PORT
```

### Einbindung im HTML (am Ende von `<body>`)

```html
<link rel="stylesheet" href="/css/admin-edit.css" />
<script src="/js/admin-state.js"></script>
<script src="/js/admin-ui.js"></script>
<script src="/js/admin-blocks.js"></script>
<script src="/js/admin-edit.js"></script>
```

### Modulübersicht

| Datei             | Zeilen | Verantwortung                                                                   |
| ----------------- | ------ | ------------------------------------------------------------------------------- |
| `admin-edit.css`  | ~530   | Alle Styles – cachebar, kein JS-Aufblähung, kein FOUC                           |
| `admin-state.js`  | ~90    | `AdminConfig`, `AdminState`, `lockScroll`, `escHtml`                            |
| `admin-ui.js`     | ~1.100 | Admin-Bar, Login-Modal, Galerie, Text-Toolbar, Notify, Backup-Modal, Bild-Skala |
| `admin-blocks.js` | ~680   | Block-System, Spalten, Undo, Save, Termin-System, Edit-Mode                     |
| `admin-edit.js`   | ~75    | Init, Auth-Check, ESC-Handler, Session-Timeout                                  |

---

## Backend – API-Routen

| Methode | Route                       | Auth | Beschreibung                                  |
| ------- | --------------------------- | ---- | --------------------------------------------- |
| POST    | `/api/login`                | –    | Login mit bcrypt-Hash, setzt HTTP-only Cookie |
| POST    | `/api/logout`               | ✓    | Löscht Session-Cookie                         |
| GET     | `/api/check-auth`           | ✓    | Prüft ob Session gültig                       |
| POST    | `/api/save-html`            | ✓    | Seite speichern + Backup erstellen            |
| GET     | `/api/images`               | ✓    | Alle Bilder auflisten (mit Metadaten)         |
| POST    | `/api/upload-image`         | ✓    | Bild hochladen + WebP-Konvertierung           |
| PATCH   | `/api/images/uploads/:name` | ✓    | Bild umbenennen                               |
| DELETE  | `/api/images/uploads/:name` | ✓    | Bild löschen                                  |
| POST    | `/api/upload-pdf`           | ✓    | PDF für Speisekarte hochladen                 |
| GET     | `/api/backups/:filename`    | ✓    | Sicherungen einer Seite auflisten             |
| POST    | `/api/restore-backup`       | ✓    | Sicherung wiederherstellen                    |
| POST    | `/api/change-password`      | ✓    | Passwort ändern                               |

**Sicherheit:** Brute-Force-Schutz (5 Versuche, 15 Min. Sperre), Helmet.js Security-Headers, Path-Traversal-Schutz auf allen Dateioperationen, Trust-Proxy-Konfiguration für Hetzner.

---

## CMS-Frontend

### Login & Session

- Versteckter Footer-Link (`~ Admin ~`) öffnet Login-Modal
- Session läuft nach 8 Stunden ab (Warnung nach 7h50min)
- Passwort ändern direkt aus der Admin-Bar

### Admin-Bar

Erscheint nach Login am unteren Bildschirmrand. Enthält:
`Bearbeiten` · `Rückgängig` · `Verwerfen` · `Speichern` · `Abmelden` · `PDF ändern` (nur Speisekarte) · `+ Text` · `+ Bild` · `+ Trennlinie` · `+ Abstand` · `Passwort ändern` · `Verlauf`

### CMS Block-System

Jeder Inhaltsbereich ist ein **CMS-Block**. Beim Bearbeiten erscheint pro Block eine schwebende Leiste mit:

| Button        | Funktion                                                        |
| ------------- | --------------------------------------------------------------- |
| ⠿ Verschieben | Drag & Drop (SortableJS)                                        |
| Größe         | Bild-Skalierung (Slider 10–100%) – nur bei Bild-Blocks          |
| Link          | Bild-Link setzen / bearbeiten / entfernen – nur bei Bild-Blocks |
| Spalten       | Block in 2 Spalten aufteilen (danach: `+ Spalte`)               |
| Block löschen | Entfernt den Block nach Bestätigung                             |

#### Spalten-System

- Erste Klick auf „Spalten": teilt Block in 2 gleichgroße Spalten
- Jeder weitere Klick auf „+ Spalte": fügt eine neue Spalte hinzu
- Bootstrap-Grid wird automatisch gleichmäßig verteilt: 2→col-6, 3→col-4, 4→col-3
- Jede Spalte hat eigene Controls: `+ Text`, `+ Bild`, `Spalte entfernen`
- Letzte verbleibende Spalte: Row wird aufgelöst, Block-UI wiederhergestellt

#### Block-Typen

| Typ        | Beschreibung                                                      |
| ---------- | ----------------------------------------------------------------- |
| Text       | Editierbarer `<p>`-Block mit Text-Toolbar                         |
| Bild       | Standalone-Bild aus der Galerie, zentriert                        |
| Trennlinie | `haarlinie.webp` als horizontaler Trenner                         |
| Abstand    | `spacer_break` – unsichtbar im Frontend, gestrichelt im Edit-Mode |

### Text-Toolbar

Floating-Leiste (links, vertikal) erscheint im Edit-Mode:
`Link einfügen/entfernen` · `Bild an Cursor einfügen` · `Fett` · `Kursiv` · `Unterstrichen` · `Durchgestrichen` · `Schriftgröße` · `Farbe Gold` · `Farbe Grau` · `Custom-Farbpicker`

### Galerie (Bildverwaltung)

- Zeigt alle Bilder nach Ordner gefiltert: Alle / Uploads / images / bilder-kneipe / galerie-Ordner
- Upload per Drag & Drop oder Dateiauswahl (bis 15 MB)
- Automatische WebP-Konvertierung serverseitig (Sharp)
- Deduplizierung: bereits vorhandene Dateien werden nicht doppelt gespeichert
- Upload-Bilder: Umbenennen direkt im Grid, Löschen mit Bestätigung
- Volltext-Suche und Ordner-Filter

### Termin-Verwaltung (termine.html)

- Termine direkt auf der Seite editierbar (Datum, Beschreibung)
- `+ Termin` Button fügt neue Zeile nach dem letzten Termin ein
- Löschen über Block-UI

### Sicherungsverlauf

- „Verlauf"-Button öffnet Modal mit allen Sicherungen der aktuellen Seite
- Sicherungen werden automatisch vor jedem Speichervorgang erstellt (max. 10 pro Seite)
- Wiederherstellen sichert den aktuellen Stand zuerst, dann wird die Sicherung eingespielt

---

## Was ist im Projektumfang enthalten

### Beauftragt & umgesetzt

- Komplettes Node.js/Express Backend
- JWT-Authentifizierung mit bcrypt
- Inline-Editing (Text, Überschriften, Listen)
- Bild-Galerie mit Upload, WebP-Konvertierung, Umbenennen, Löschen
- CMS Block-System mit Drag & Drop
- Spalten-System (Split, hinzufügen, entfernen, rebalance)
- Termin-Verwaltung
- Text-Toolbar (fett, kursiv, unterstrichen, Links, Bilder, Schriftgröße, Farbe)
- Admin-Bar mit Mobile-Support
- Session-Management mit Timeout-Warnung
- Passwort ändern
- Brute-Force-Schutz
- Sicherungsverlauf pro Seite (Backup + Restore)
- Bild-Skalierung per Slider
- Footer-Bearbeitung
- Custom Confirm/Alert-Dialoge
- Bild-Link setzen/bearbeiten/entfernen

### Zusätzlich ohne Aufpreis umgesetzt

- Sitemap.xml mit automatischem `lastmod`-Update beim Speichern
- robots.txt
- Custom 404-Seite
- Security-Header (Helmet.js)
- Automatisches Backup-Cleanup (max. 10 pro Seite)
- Mobile Admin-Bar
- Session-Timeout-Warnung
- Deduplizierung beim Bild-Upload
- PDF-Upload für Speisekarte
- **Code-Refactoring:** Aufteilung in Module, XSS-Fixes, Undo-Bug behoben

---

## Preiseinschätzung

| Leistung                                 | Stunden   |
| ---------------------------------------- | --------- |
| Backend (Server, Auth, API, Security)    | ~20 h     |
| CMS-Frontend (alle Features)             | ~35 h     |
| Block-System inkl. Spalten & Drag & Drop | ~10 h     |
| Galerie + Upload                         | ~6 h      |
| Sicherungsverlauf + Restore              | ~4 h      |
| Bugfixing & Refactoring                  | ~15 h     |
| **Gesamt**                               | **~90 h** |

**Üblicher Stundensatz Webentwicklung (DE): 22–40 €/h**

| Kalkulation   | Betrag  |
| ------------- | ------- |
| 90 h × 20 €/h | 1.800 € |
| -20%          | 1.440 € |

---

_Letzte Aktualisierung: Februar 2026_

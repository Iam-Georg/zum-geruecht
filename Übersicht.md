# Zum Gerücht – CMS & Website Projektübersicht

## Projektzeitraum

Ca. 2 Wochen, täglich ~4 Stunden Entwicklungsarbeit


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
│   ├── images/             – Statische Bilder (WebP)
│   └── uploads/            – Hochgeladene Bilder (WebP)
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

| Datei             | Zeilen  | Verantwortung                                                                   |
| ----------------- | ------- | ------------------------------------------------------------------------------- |
| `admin-edit.css`  | ~600    | Alle Styles – cachebar, kein JS-Aufblähung, kein FOUC                           |
| `admin-state.js`  | ~90     | `AdminConfig`, `AdminState`, `lockScroll`, `escHtml`                            |
| `admin-ui.js`     | ~1.300  | Admin-Bar, Login, Galerie, Text-Toolbar, Notify, Backup-Modal, Bild-Skala       |
| `admin-blocks.js` | ~680    | Block-System, Spalten, Undo, Save, Termin-System, Edit-Mode                     |
| `admin-edit.js`   | ~75     | Init, Auth-Check, ESC-Handler, Session-Timeout                                  |


## Backend – API-Routen

| Methode | Route                            | Auth | Beschreibung                                      |
| ------- | -------------------------------- | ---- | ------------------------------------------------- |
| POST    | `/api/login`                     | –    | Login mit bcrypt-Hash, setzt HTTP-only Cookie     |
| POST    | `/api/logout`                    | ✓    | Löscht Session-Cookie                             |
| GET     | `/api/check-auth`                | ✓    | Prüft ob Session gültig                           |
| POST    | `/api/save-html`                 | ✓    | Seite speichern + Backup erstellen                |
| GET     | `/api/images`                    | ✓    | Alle .webp-Bilder auflisten + Ordnerliste         |
| POST    | `/api/upload-image`              | ✓    | Bild hochladen + WebP-Konvertierung               |
| PATCH   | `/api/images/uploads/:name`      | ✓    | Bild umbenennen (nur uploads)                     |
| DELETE  | `/api/images/:folder/:filename`  | ✓    | Bild löschen (.webp + Original) aus beliebigem Ordner |
| POST    | `/api/folders`                   | ✓    | Neuen Bild-Ordner anlegen                         |
| POST    | `/api/images/move`               | ✓    | Bild zwischen Ordnern verschieben                 |
| POST    | `/api/upload-pdf`                | ✓    | PDF für Speisekarte hochladen                     |
| GET     | `/api/backups/:filename`         | ✓    | Sicherungen einer Seite auflisten                 |
| POST    | `/api/restore-backup`            | ✓    | Sicherung wiederherstellen                        |
| POST    | `/api/change-password`           | ✓    | Passwort ändern                                   |

**Sicherheit:** Brute-Force-Schutz (3 Versuche, 15 Min. Sperre), Helmet.js Security-Headers, Path-Traversal-Schutz auf allen Dateioperationen, Trust-Proxy-Konfiguration für Hetzner.

## CMS-Frontend

### Login & Session

- Fester Login/Logout-Button (Person-Icon) rechts am Bildschirmrand, direkt über dem `schalter_oben` – immer sichtbar
- Eingeloggt: Icon wechselt zu Pfeil-raus, Klick loggt direkt aus
- Session läuft nach 8 Stunden ab (Warnung nach 7h50min)
- Passwort ändern direkt aus der Admin-Bar

### Admin-Bar

Erscheint nach Login am unteren Bildschirmrand. Enthält:
`Bearbeiten` · `Rückgängig` · `Verwerfen` · `Speichern` · `PDF ändern` (nur Speisekarte) · `+ Text` · `+ Bild` · `+ Trennlinie` · `+ Abstand` · `Passwort ändern` · `Verlauf`

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

- Erster Klick auf „Spalten": teilt Block in 2 gleichgroße Spalten
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

- Zeigt ausschließlich `.webp`-Dateien (einheitliches Format, kein Wildwuchs)
- Ordner-Tabs dynamisch aus Verzeichnisstruktur generiert – kein Hardcoding
- Ordner-Verwaltung per Toggle: Bilder per Drag & Drop auf Ordner-Tabs verschieben
- Eigene Ordner direkt aus der Galerie heraus anlegen
- Upload per Drag & Drop oder Dateiauswahl (bis 15 MB), automatische WebP-Konvertierung, direkt in den gewählten Ziel-Ordner
- Deduplizierung: bereits vorhandene Dateien werden nicht doppelt gespeichert
- Bilder aus uploads: Umbenennen direkt im Grid
- Löschen aus beliebigem Ordner – entfernt `.webp` und das Original (jpg/png/…) automatisch
- Volltext-Suche links in der Filter-Leiste, Ordner-Tabs daneben
- Im Ordner-Verwaltungs-Modus ist Bild-Auswahl deaktiviert (kein versehentlicher Tausch)

### Termin-Verwaltung (termine.html)

- Termine direkt auf der Seite editierbar (Datum, Beschreibung)
- `+ Termin` Button fügt neue Zeile nach dem letzten Termin ein
- Löschen über Block-UI

### Sicherungsverlauf

- „Verlauf"-Button öffnet Modal mit allen Sicherungen der aktuellen Seite
- Sicherungen werden automatisch vor jedem Speichervorgang erstellt (max. 10 pro Seite)
- Wiederherstellen sichert den aktuellen Stand zuerst, dann wird die Sicherung eingespielt

### Footer-Bearbeitung

- `#footer`-Elemente sind im Edit-Mode vollständig bearbeitbar
- Jedes Footer-Element bekommt eine Block-UI

### Custom-Dialoge

Alle Browser-nativen `confirm()` und `alert()` wurden durch custom Dialoge im Site-Stil ersetzt (Blur-Backdrop, transparenter Hintergrund, goldene Ränder).

## Was ist im Projektumfang enthalten

### Beauftragt & umgesetzt

- Komplettes Node.js/Express Backend
- JWT-Authentifizierung mit bcrypt
- Inline-Editing (Text, Überschriften, Listen)
- Bild-Galerie mit Upload, WebP-Konvertierung, Ordner-Verwaltung, Umbenennen, Löschen
- CMS Block-System mit Drag & Drop
- Spalten-System (Split, hinzufügen, entfernen, rebalance)
- Termin-Verwaltung
- Text-Toolbar (fett, kursiv, unterstrichen, Links, Bilder, Schriftgröße, Farbe)
- Admin-Bar mit Mobile-Support
- Login/Logout-Button dauerhaft sichtbar (passt sich an `schalter_oben` an)
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
- Dynamische Ordner-Erkennung in der Galerie (kein Hardcoding)
- Paste-Cleanup: Formatierungs-Müll aus Word/Google Docs wird beim Einfügen automatisch entfernt
- Upload direkt in Ziel-Ordner (kein nachträgliches Verschieben nötig)

## Mögliche Erweiterungen (nicht im Projektumfang)

| Feature                          | Aufwand | Einordnung         |
| -------------------------------- | ------- | ------------------ |
| Alt-Text für Bilder editierbar   | ~2 h    | SEO / Barrierefreiheit |
| Auto-Save Entwurf (localStorage) | ~3 h    | Komfort            |
| Schrittweises Undo               | ~8 h    | Komfort            |

## Preiseinschätzung

| Leistung                                 | Stunden   |
| ---------------------------------------- | --------- |
| Backend (Server, Auth, API, Security)    | ~20 h     |
| CMS-Frontend (alle Features)             | ~35 h     |
| Block-System inkl. Spalten & Drag & Drop | ~10 h     |
| Galerie + Upload + Ordner-Verwaltung     | ~10 h      |
| Sicherungsverlauf + Restore              | ~4 h      |
| Bugfixing & Feinschliff                  | ~13 h     |
| **Gesamt**                               | **~92 h** |

**Üblicher Stundensatz Webentwicklung (DE): 22–40 €/h**

| Kalkulation   | Betrag  |
| ------------- | ------- |
| 92 h × 20 €/h | 1.840 € |
| -20%          | 1.472 € |

---

_Letzte Aktualisierung: Februar 2026_
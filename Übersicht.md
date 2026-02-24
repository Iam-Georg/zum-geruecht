# Zum Gerücht – CMS & Website Projektübersicht

## Projektzeitraum
Ca. 2 Wochen, täglich ~4 Stunden Entwicklungsarbeit

---

## Technologie-Stack

| Schicht | Technologie |
|---|---|
| Server | Node.js + Express |
| Auth | bcrypt + HTTP-only Cookies + JWT |
| Frontend | Vanilla JS (kein Framework) |
| Styling | Bootstrap 3 + Custom CSS |
| Bilder | Sharp (WebP-Konvertierung serverseitig) |
| Drag & Drop | SortableJS (CDN) |
| Hosting | Hetzner (empfohlen) |

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
│   │   └── admin-edit.js   – Komplettes CMS-Frontend
│   ├── css/
│   │   ├── zum-geruecht.css
│   │   └── bootstrap.css
│   ├── images/             – Statische Bilder
│   └── images/uploads/     – Hochgeladene Bilder (WebP)
├── backups/                – Automatische HTML-Sicherungen (max. 10/Seite)
└── .env                    – ADMIN_PASSWORD_HASH, JWT_SECRET, PORT
```

---

## Backend – API-Routen

| Methode | Route | Auth | Beschreibung |
|---|---|---|---|
| POST | `/api/login` | – | Login mit bcrypt-Hash, setzt HTTP-only Cookie |
| POST | `/api/logout` | ✓ | Löscht Session-Cookie |
| GET | `/api/check-auth` | ✓ | Prüft ob Session gültig |
| POST | `/api/save-html` | ✓ | Seite speichern + Backup erstellen |
| GET | `/api/images` | ✓ | Alle Bilder auflisten (mit Metadaten) |
| POST | `/api/upload-image` | ✓ | Bild hochladen + WebP-Konvertierung |
| DELETE | `/api/images/uploads/:name` | ✓ | Bild löschen |
| POST | `/api/upload-pdf` | ✓ | PDF für Speisekarte hochladen |
| GET | `/api/backups/:filename` | ✓ | Sicherungen einer Seite auflisten |
| POST | `/api/restore-backup` | ✓ | Sicherung wiederherstellen |
| POST | `/api/change-password` | ✓ | Passwort ändern |

**Sicherheit:** Brute-Force-Schutz (5 Versuche, 15 Min. Sperre), Helmet.js Security-Headers, Path-Traversal-Schutz auf allen Dateioperationen, Trust-Proxy-Konfiguration für Hetzner.

---

## CMS-Frontend (admin-edit.js)

Die gesamte Admin-Logik ist in einer einzigen Datei (`admin-edit.js`) gebündelt, die nur eingeloggten Admins ausgeliefert wird.

### Login & Session
- Versteckter Footer-Link (`~ Admin ~`) öffnet Login-Modal
- Session läuft nach 8 Stunden ab (Warnung nach 7h50min)
- Passwort ändern direkt aus der Admin-Bar

### Admin-Bar
Erscheint nach Login oben am Bildschirm. Enthält:
`Bearbeiten` · `Rückgängig` · `Verwerfen` · `Speichern` · `Abmelden` · `PDF ändern` (nur Speisekarte) · `+ Text` · `+ Bild` · `+ Trennlinie` · `+ Abstand` · `Passwort ändern` · `Verlauf`

### CMS Block-System
Jeder Inhaltsbereich ist ein **CMS-Block**. Beim Bearbeiten erscheint pro Block eine schwebende Leiste mit:

| Button | Funktion |
|---|---|
| ⠿ Verschieben | Drag & Drop (SortableJS) |
| Größe | Bild-Skalierung (Slider 10–100%) – nur bei Bild-Blocks |
| Link | Bild-Link setzen / bearbeiten / entfernen – nur bei Bild-Blocks |
| Spalten | Block in 2 Spalten aufteilen (danach: `+ Spalte`) |
| Block löschen | Entfernt den Block nach Bestätigung |

#### Spalten-System
- Erste Klick auf „Spalten": teilt Block in 2 gleichgroße Spalten
- Jeder weitere Klick auf „+ Spalte": fügt **eine** neue Spalte hinzu
- Bootstrap-Grid wird automatisch gleichmäßig verteilt: 2→col-6, 3→col-4, 4→col-3
- Jede Spalte hat eigene Controls: `+ Text`, `+ Bild`, `Spalte entfernen`
- Letzte verbleibende Spalte: Row wird aufgelöst, Block-UI wiederhergestellt

#### Block-Typen
| Typ | Beschreibung |
|---|---|
| Text | Editierbarer `<p>`-Block mit Text-Toolbar |
| Bild | Standalone-Bild aus der Galerie, zentriert |
| Trennlinie | `haarlinie.webp` als horizontaler Trenner |
| Abstand | `spacer_break` – unsichtbar im Frontend, gestrichelt im Edit-Mode |

### Text-Toolbar
Floating-Toolbar erscheint bei Textauswahl:
`Fett` · `Kursiv` · `Unterstrichen` · `Link einfügen` · `Bild einfügen` · `H1` · `H2` · `H3`

### Galerie (Bildverwaltung)
- Zeigt alle Bilder nach Ordner gefiltert: Alle / Uploads / bilder-kneipe / images
- Upload per Drag & Drop oder Dateiauswahl
- Automatische WebP-Konvertierung serverseitig (Sharp)
- Deduplizierung: bereits vorhandene Dateien werden nicht doppelt gespeichert
- Löschen mit Custom-Confirm-Dialog
- Dateigrößenanzeige
- Vollbild-Vorschau

### Termin-Verwaltung (termine.html)
- Termine direkt auf der Seite editierbar (Datum, Beschreibung)
- `+ Termin` Button fügt neue Zeile hinzu
- Löschen über Block-UI

### Sicherungsverlauf
- „Verlauf"-Button öffnet Modal mit allen Sicherungen der aktuellen Seite
- Sicherungen werden automatisch vor jedem Speichervorgang erstellt (max. 10 pro Seite)
- Wiederherstellen sichert den aktuellen Stand zuerst, dann wird die Sicherung eingespielt

### Footer-Bearbeitung
- `#footer` Elemente sind im Edit-Mode vollständig bearbeitbar
- Jedes Footer-Element bekommt eine Block-UI

### Custom-Dialoge
Alle Browser-nativen `confirm()` und `alert()` wurden durch custom Dialoge im Site-Stil ersetzt (dunkel, goldene Ränder, keine browser-typischen Fenster).

---

## Was ist im Projektumfang enthalten

### Beauftragt & umgesetzt
- Komplettes Node.js/Express Backend
- JWT-Authentifizierung mit bcrypt
- Inline-Editing (Text, Überschriften, Listen)
- Bild-Galerie mit Upload, WebP-Konvertierung, Löschen
- CMS Block-System mit Drag & Drop
- Spalten-System (Split, hinzufügen, entfernen, rebalance)
- Termin-Verwaltung
- Text-Toolbar (fett, kursiv, unterstrichen, Links, Bilder, Überschriften)
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

---

## Preiseinschätzung

| Leistung | Stunden |
|---|---|
| Backend (Server, Auth, API, Security) | ~20 h |
| CMS-Frontend (admin-edit.js, alle Features) | ~35 h |
| Block-System inkl. Spalten & Drag & Drop | ~10 h |
| Galerie + Upload | ~6 h |
| Sicherungsverlauf + Restore | ~4 h |
| Bugfixing | ~10 h |
| **Gesamt** | **~85 h** |

**Üblicher Stundensatz Webentwicklung (DE): 22–40 €/h**

| Kalkulation | Betrag |
|---|---|
| 85 h × 20 €/h | 1.700 € |
| -20% | 1.360 € |

---

*Letzte Aktualisierung: Februar 2026*
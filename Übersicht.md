# Zum Gerücht – Website & CMS

## Was du bekommst

Eine **vollständige, fertige Website** mit eingebautem Redaktionssystem –
keine monatlichen Abo-Kosten, keine Abhängigkeit von Baukästen wie WordPress
oder Wix, kein Drittanbieter der Zugang oder Preise jederzeit ändern kann.
**Alles gehört dir.**

---

## Was du im Alltag tun kannst

| Aufgabe | So einfach geht's |
|---|---|
| Text ändern | Einloggen → auf den Text klicken → tippen → Speichern |
| Bild tauschen | Auf das Bild klicken → Galerie öffnet sich → neues Bild wählen |
| Termin hinzufügen | „+ Termin" klicken → Datum & Text eintragen → Speichern |
| Neues Bild hochladen | In der Galerie per Drag & Drop ablegen – fertig |
| Speisekarte aktualisieren | Neue PDF hochladen – sofort live |
| Seite wiederherstellen | Verlauf öffnen → beliebige Sicherung mit einem Klick zurückspielen |
| Passwort ändern | Direkt in der Admin-Leiste, ohne Umwege |

---

## Die Seiten

| Seite | Inhalt |
|---|---|
| Startseite | Willkommen, freie Inhaltsblöcke |
| Speisekarte | PDF-Einbindung, jederzeit austauschbar |
| Termine | Veranstaltungskalender, direkt editierbar |
| Galerie | Fotogalerie mit Lightbox |
| Reservierungen | Anfrage-Formular |
| Geschichte | Freie Inhaltsseite |
| Jobs | Freie Inhaltsseite |
| Anfahrt | Freie Inhaltsseite |
| Impressum / Datenschutz | Vorhanden und bearbeitbar |

---

## Das CMS – was steckt dahinter

### Einloggen & Abmelden
Ein kleiner Button (Personen-Icon) sitzt dauerhaft rechts unten im Bild –
immer sichtbar, unauffällig. Klick → Passwort eingeben → eingeloggt.
Nach dem Login wechselt das Icon auf „Abmelden". Die Session läuft nach
8 Stunden automatisch ab, mit Warnung 10 Minuten vorher.

### Bearbeiten – direkt auf der Seite
Kein separates Backend, kein zweites Fenster. Du siehst exakt was der
Besucher sieht – und klickst einfach drauf.

- **Texte:** Jeder Absatz, jede Überschrift, jede Liste ist klickbar und direkt editierbar
- **Schriftformatierung:** Fett, Kursiv, Unterstrichen, Schriftgröße, Farbe (Gold, Grau oder frei wählbar)
- **Links:** In Texte einfügbar, auch Bildverlinkungen
- **Bilder:** Klick auf ein Bild → Galerie öffnet sich → tauschen

### Inhaltsblöcke (das Herzstück)
Jeder Inhaltsbereich ist ein Block. Blocks können:
- **Verschoben** werden (Drag & Drop)
- **Gesplittet** werden (1 → 2 Spalten → 3 Spalten …)
- **Gelöscht** werden (mit Bestätigung)
- **Skaliert** werden (Bilder: Schieberegler 10–100%)

Zusätzliche Inhalte hinzufügen über die Admin-Leiste:
`+ Text` · `+ Bild` · `+ Trennlinie` · `+ Abstand`

### Texte einfügen aus Word oder Google Docs
Wer Texte aus einem anderen Programm einfügt, kennt das Problem:
Fremde Schriftarten, Farben und Abstände landen im HTML und zerstören
das Design. Das ist hier **automatisch verhindert** – beim Einfügen
wird alles auf sauberen Text normiert.

### Galerie & Bildverwaltung
- Zeigt ausschließlich optimierte `.webp`-Bilder (schnell, modernes Format)
- Bilder werden beim Upload automatisch in WebP konvertiert
- Ordner frei organisierbar: eigene Ordner anlegen, Bilder per Drag & Drop verschieben
- Hochladen landet direkt im Ordner in dem man sich gerade befindet
- Umbenennen direkt im Grid
- Löschen entfernt automatisch auch das Original (jpg/png) – kein Datenmüll

### Sicherungen – nichts geht verloren
Vor jedem Speichern wird automatisch eine Sicherung angelegt.
Pro Seite werden die letzten 10 Versionen aufbewahrt.
Jede Sicherung ist mit Datum versehen und mit einem Klick wiederherstellbar –
der aktuelle Stand wird dabei ebenfalls gesichert, bevor er überschrieben wird.

---

## Sicherheit

Das CMS wurde von Anfang an mit Sicherheit entwickelt – kein nachträgliches Flickwerk.

| Maßnahme | Was das bedeutet |
|---|---|
| Admin-Code geschützt | Alle CMS-Dateien sind nur nach dem Einloggen abrufbar – kein Besucher kann die Struktur des Systems einsehen |
| Brute-Force-Schutz | Nach 3 Fehlversuchen wird die IP 15 Minuten gesperrt |
| HTTP-only Cookies | Das Login-Token ist für JavaScript unsichtbar – kein Diebstahl per Browser-Script möglich |
| Path-Traversal-Schutz | Alle Dateioperationen sind gegen Angriffe auf andere Verzeichnisse abgesichert |
| XSS-Schutz | Alle Daten aus der Datenbank und von API-Antworten werden vor der Darstellung bereinigt |
| Security-Header | Helmet.js setzt alle empfohlenen HTTP-Sicherheitsheader |

---

## Technologie

| Schicht | Technologie | Warum |
|---|---|---|
| Server | Node.js + Express | Schnell, weit verbreitet, leicht zu hosten |
| Authentifizierung | bcrypt + JWT + HTTP-only Cookies | Industrie-Standard |
| Frontend | Vanilla JS (kein Framework) | Keine externen Abhängigkeiten, läuft ewig ohne Updates |
| Styling | Bootstrap 3 + Custom CSS | Stabil, responsiv |
| Bildoptimierung | Sharp (WebP) | Bilder automatisch fürs Web optimiert |
| Drag & Drop | SortableJS | Bewährte, schlanke Library |
| Hosting | Hetzner empfohlen | Deutsch, DSGVO-konform, günstig |

---

## Dateistruktur

```
/
├── server.js                  – Backend, alle API-Routen
├── public/
│   ├── index.html             – Startseite
│   ├── termine.html
│   ├── speisekarte.html
│   ├── mediathek.html
│   ├── anfrage.html
│   ├── impressum.html / datenschutz.html
│   ├── js/
│   │   ├── admin-loader.js    – Einzige öffentliche Admin-Datei (Login)
│   │   ├── admin-state.js     – Nur nach Login abrufbar
│   │   ├── admin-ui.js        – Nur nach Login abrufbar
│   │   ├── admin-blocks.js    – Nur nach Login abrufbar
│   │   └── admin-edit.js      – Nur nach Login abrufbar
│   ├── css/
│   │   ├── zum-geruecht.css
│   │   ├── bootstrap.css
│   │   └── admin-edit.css
│   ├── images/
│   └── uploads/
├── backups/                   – Automatische Sicherungen (max. 10/Seite)
└── .env                       – Passwort-Hash, JWT-Secret, Port
```

---

## API-Routen

| Methode | Route | Beschreibung |
|---|---|---|
| POST | `/api/login` | Login, setzt HTTP-only Cookie |
| POST | `/api/logout` | Abmelden |
| GET | `/api/check-auth` | Session prüfen |
| POST | `/api/save-html` | Seite speichern + Backup |
| GET | `/api/images` | Alle Bilder + Ordnerliste |
| POST | `/api/upload-image` | Bild hochladen + WebP-Konvertierung |
| PATCH | `/api/images/uploads/:name` | Bild umbenennen |
| DELETE | `/api/images/:folder/:name` | Bild löschen (inkl. Original) |
| POST | `/api/folders` | Neuen Ordner anlegen |
| POST | `/api/images/move` | Bild zwischen Ordnern verschieben |
| POST | `/api/upload-pdf` | Speisekarte als PDF hochladen |
| GET | `/api/backups/:seite` | Sicherungen einer Seite auflisten |
| POST | `/api/restore-backup` | Sicherung wiederherstellen |
| POST | `/api/change-password` | Passwort ändern |

---

## Inbegriffen ohne Aufpreis

- `sitemap.xml` mit automatischem Datum-Update beim Speichern
- `robots.txt`
- Mobile-Optimierung der Admin-Leiste
- Session-Timeout-Warnung (10 min vor Ablauf)
- Deduplizierung beim Bild-Upload (kein doppeltes Hochladen)
- Alle Browser-Dialoge im Design der Website (kein generisches Browserfenster)

---

## Zukunftssicherheit

Das System ist bewusst so gebaut, dass es **ohne laufende Kosten und ohne
Abhängigkeiten** funktioniert:

- Kein Plugin-System das veraltet oder kostenpflichtig wird
- Kein CMS-Framework das Updates erzwingt
- Kein Abo, keine Lizenz
- Der Code ist verständlich und kann von jedem Webentwickler erweitert werden
- Neue Ordner für die Galerie: direkt aus der Galerie heraus anlegen

---

## Preiseinschätzung

| Leistung | Stunden |
|---|---|
| Backend (Server, Auth, API, Sicherheit) | ~20 h |
| CMS-Frontend (alle Features) | ~35 h |
| Block-System, Spalten, Drag & Drop | ~10 h |
| Galerie, Upload, Ordner-Verwaltung | ~8 h |
| Sicherungsverlauf & Restore | ~4 h |
| Feinschliff, Tests, Sicherheit | ~13 h |
| **Gesamt** | **~90 h** |

**Marktüblicher Stundensatz (DE): 22–40 €/h**

| | |
|---|---|
| 90 h × 13,90 €/h (Mindestansatz) | 1.251 € |
| Preis (19 %) | **1.488,69 €** |

---

*Letzte Aktualisierung: Februar 2026*
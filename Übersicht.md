## Dokumentation www.zum-geruecht.de
---
## Was ursprünglich beauftragt wurde

Ursprünglich sollte es nur **ein CMS** werden, damit Texte/Bilder/Termine etc. ohne externe Hilfe geändert werden können.

> Die Website lief auf einem veralteten PHP-Server ohne jegliche Backend-Infrastruktur. Ein modernes CMS benötigt zwingend ein Backend – also einen eigenen Server, eine Authentifizierung, eine API.
Anstatt ein halbfertiges System zu liefern, hab ich die gesamte technische Basis neu gebaut – und dabei wurden alle anderen sichtbaren Schwachstellen/Fehler der Website gleich mitbehoben. 

---

## Was wurde gebaut – und warum war es notwendig

### Backend & Server (Grundvoraussetzung für alles andere)

| Was | Warum notwendig |
|-----|-----------------|
| Node.js/Express Server | Ohne Server keine Möglichkeit, Inhalte zu speichern oder zu schützen |
| Sicherer Admin-Login (JWT) | Ohne Login kann jeder die Website verändern |
| Brute-Force-Schutz | Ohne Schutz ist das Passwort in Minuten knackbar |
| Automatische Backups | Ohne Backup ist eine versehentliche Löschung nicht rückgängig machbar |
| WebP-Bildkonvertierung | Bilder werden automatisch komprimiert – Ladezeit halbiert sich |

### CMS – Content Managemant System

| Was | Konkreter Nutzen |
|-----|-----------------|
| Texte direkt anklicken & ändern | Neuer Konzerttermin? 30 Sekunden, kein Anruf nötig |
| Bilder tauschen per Klick | Saisonale Fotos aktuell halten ohne externe Hilfe |
| Bilder hochladen per Drag & Drop | So einfach wie ein Foto per WhatsApp schicken |
| Bilder umbenennen & löschen | Ordnung in der Galerie ohne FTP-Zugang |
| Rückgängig & Verwerfen | Fehler passieren – hier sind sie kein Problem |
| Speichern mit einem Klick | Änderungen sind sofort live |
| **Funktioniert auf Handy** | Schnell etwas ändern auch unterwegs |

### Was zusätzlich behoben wurde – ohne Mehrkosten

| Problem | Was es heißt |
|---------|----------------------|
| Kein Social-Media-Vorschaubild | Beim Teilen in WhatsApp/Facebook erschien nur ein Link |
| Keine Sitemap | Google wusste nicht welche Seiten existieren |
| Keine Clean URLs | /speisekarte.html statt /speisekarte – wirkt veraltet |
| Ladezeit-Probleme | 58 Bilder wurden gleichzeitig geladen – auf Handy teils 10+ Sekunden |
| Veraltetes Kontaktformular | Optisch nicht zur Website passend, keine Spam-Absicherung |

---

## Was das in Zahlen bedeutet

### Agenturvergleich
| Leistung | Marktpreis Agentur |
|----------|--------------------|
| Backend + Server + Login + Sicherheit | 1.200 – 2.500 € |
| Individuelles CMS (Text + Bild + Galerie) | 2.500 – 4.500 € |
| Mobile Admin-Oberfläche | 300 – 600 € |
| SEO-Optimierung (Sitemap, OG-Tags, Clean URLs) | 500 – 900 € |
| Technische Bereinigung + Performance | 300 – 600 € |
| Formular-Redesign + Sicherheit | 200 – 400 € |
| **Gesamt** | **5.000 – 9.500 €** |

---

## Preis

**1.000 €**

---

## Nach der Einigung – was passiert als nächstes

### Was du als Entwickler erledigst (ca. 1–2 Stunden)
1. **Hosting einrichten** – Hetzner Cloud VPS, ca. 4 €/Monat, DSGVO-konform in Deutschland
2. **SSL-Zertifikat** – kostenlos über Let's Encrypt, HTTPS aktivieren
3. **E-Mail-Versand einrichten** – damit Reservierungsanfragen ankommen (dazu brauchst du vom Betreiber: E-Mail-Anbieter, Adresse und Passwort)
4. **Alle Dateien deployen** – Website auf den neuen Server laden
5. **Domain umstellen** – DNS-Eintrag auf neuen Server zeigen lassen (der Betreiber muss einmalig in seinem Domain-Account den Nameserver ändern oder einen A-Record setzen)

### Was der Betreiber bereitstellt
- E-Mail-Zugangsdaten für Reservierungsanfragen (SMTP)
- Zugang zur Domain-Verwaltung (Strato, IONOS o.ä.) für DNS-Umstellung
- Einmalig das Admin-Passwort festlegen

### Was du dem Betreiber nach Übergabe erklärst (15 Minuten)
1. Wie man sich einloggt (Footer-Link "~ Admin ~", Passwort eingeben)
2. Wie man einen Text ändert (klicken, tippen, speichern)
3. Wie man ein Bild tauscht (auf Bild klicken, neues auswählen oder hochladen)
4. Wie man sich ausloggt

Das war's. Der Rest erschließt sich von selbst.

---

## Laufende Kosten für den Betreiber

| Was | Kosten |
|-----|--------|
| Hetzner VPS (Server) | 3,79 €/Monat |
| Domain (falls vorhanden) | 0 € |
| SSL-Zertifikat | 0 € |
| **Gesamt** | **ca. 4 €/Monat** |

---

## Empfehlung für nach der Übergabe (optional, kein Muss)

- **Google Search Console** – Sitemap einreichen damit Google die Seite schneller indexiert (kostenlos, 5 Minuten)
- **Matomo Analytics** – DSGVO-konforme Besucherstatistiken (kostenlos selbst hostbar)

---

*Erstellt Februar 2026*
## Hosting auf einem VPS (Hetzner empfohlen)

1. Node.js auf dem Server installieren
2. Projekt hochladen (ohne `node_modules/`)
3. `npm install` auf dem Server ausführen
4. Mit **PM2** den Server dauerhaft laufen lassen:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "zum-geruecht"
   pm2 save
   pm2 startup
   ```
5. Nginx als Reverse Proxy einrichten (Port 3000 → Port 80/443)
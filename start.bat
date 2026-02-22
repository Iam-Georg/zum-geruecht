@echo off
echo.
echo  ========================================
echo   Zum Geruecht CMS - Server starten
echo  ========================================
echo.

REM Prüfen ob .env existiert
if not exist ".env" (
    echo  [!] .env Datei nicht gefunden!
    echo  [!] Kopiere .env.example zu .env und passe die Werte an.
    echo.
    pause
    exit /b 1
)

REM Prüfen ob node_modules existiert
if not exist "node_modules" (
    echo  [*] Installiere Abhängigkeiten...
    npm install
    echo.
)

echo  [*] Server wird gestartet...
echo  [*] Öffne dann: http://localhost:3000
echo.
node server.js
pause

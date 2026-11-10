@echo off
rem Uruchomienie gry lokalnie (Michal 10.11.2026): najnowszy kod z dev, paczki przy pierwszym razie, przegladarka i serwer;
rem w osobnym, zminimalizowanym oknie co 20 s pobierany jest nowy kod (aktualizuj.bat)
cd /d "%~dp0"
git pull origin dev
if not exist node_modules call npm install
start "Project-1: aktualizacja z dev" /min "%~dp0aktualizuj.bat"
start "" http://localhost:5173/
npm run dev -- --strictPort
pause

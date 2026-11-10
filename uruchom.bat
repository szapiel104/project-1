@echo off
rem Uruchomienie gry lokalnie (Michal 10.11.2026): najnowszy kod z dev, paczki przy pierwszym razie, przegladarka i serwer
cd /d "%~dp0"
git pull origin dev
if not exist node_modules call npm install
start "" http://localhost:5173/
npm run dev
pause

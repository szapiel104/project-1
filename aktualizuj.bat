@echo off
rem Co 20 s pobiera nowy kod z dev (Michal 10.11.2026). Serwer gry (npm run dev) sam podchwytuje zmienione pliki,
rem a gra pokazuje napis "Nowy kod gotowy" - wtedy F5. Okno uruchamia uruchom.bat (zminimalizowane).
cd /d "%~dp0"
title Project-1: aktualizacja z dev
:petla
git pull --ff-only -q origin dev
timeout /t 20 /nobreak >nul
goto petla

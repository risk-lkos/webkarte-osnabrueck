@echo off
rem Startet die Web-Karte lokal (ohne Internet-Server) und oeffnet den Browser.
rem Fenster schliessen beendet den Server. Doppelklick genuegt.
cd /d "%~dp0"
echo Web-Karte laeuft unter http://127.0.0.1:8765/
echo Dieses Fenster offen lassen; Schliessen beendet den Server.
start "" /b cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8765/"
"C:\Users\slidd\miniforge3\envs\ox\python.exe" -m http.server 8765 --directory docs --bind 127.0.0.1

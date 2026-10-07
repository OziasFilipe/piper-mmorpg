@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
echo Abrindo As Aventuras do Piper em http://localhost:3000
start "" http://localhost:3000
node server.js
pause

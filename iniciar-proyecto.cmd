@echo off
setlocal

cd /d "%~dp0"
title RMC Inventory - Servidor local

echo.
echo ==========================================
echo   RMC Inventory - iniciar proyecto
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en el PATH.
  echo Instala Node.js y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm no esta instalado o no esta en el PATH.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Instalando dependencias...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo ERROR: No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

if exist "prisma\schema.prisma" (
  echo Preparando Prisma...
  call npx prisma generate
  if errorlevel 1 (
    echo.
    echo ERROR: No se pudo generar el cliente de Prisma.
    pause
    exit /b 1
  )
)

echo.
echo Abriendo http://localhost:3000 ...
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:3000'"

echo.
echo Iniciando servidor de desarrollo...
echo Para detenerlo, cierra esta ventana o presiona Ctrl+C.
echo.

call npm run dev

echo.
echo El servidor se detuvo.
pause

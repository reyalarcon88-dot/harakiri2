@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title RMC Inventory - Sistema local

echo.
echo ==========================================
echo   RMC Inventory - iniciar sistema local
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js no esta instalado. Intentando instalar Node.js LTS...
  echo.

  where winget >nul 2>nul
  if errorlevel 1 (
    echo ERROR: No se encontro winget para instalar Node.js automaticamente.
    echo Instala Node.js LTS desde:
    echo   https://nodejs.org/
    echo.
    echo Despues cierra esta ventana y ejecuta este archivo otra vez.
    pause
    exit /b 1
  )

  winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo.
    echo ERROR: winget no pudo instalar Node.js.
    echo Instala Node.js LTS manualmente desde:
    echo   https://nodejs.org/
    echo.
    pause
    exit /b 1
  )

  echo.
  echo Node.js fue instalado. Actualizando PATH para esta ventana...
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js se instalo, pero Windows aun no actualizo el PATH.
  echo Cierra esta ventana y ejecuta iniciar-proyecto.cmd otra vez.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: npm no esta instalado o no esta en el PATH.
  echo npm normalmente viene incluido con Node.js.
  echo Reinstala Node.js LTS desde:
  echo   https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo Node:
node --version
echo npm:
call npm --version
echo.

echo Verificando dependencias...
if not exist "node_modules\" (
  if exist "package-lock.json" (
    echo Instalando dependencias con npm ci...
    call npm ci --no-audit --no-fund
  ) else (
    echo Instalando dependencias con npm install...
    call npm install --no-audit --no-fund
  )

  if errorlevel 1 (
    echo.
    echo ERROR: No se pudieron instalar las dependencias.
    echo Revisa tu conexion a internet y vuelve a intentar.
    echo.
    pause
    exit /b 1
  )
) else (
  echo Dependencias encontradas.
)

if not exist ".env" (
  echo Creando .env local...
  > ".env" echo DATABASE_URL=file:./prisma/db/custom.db
  >> ".env" echo.
  >> ".env" echo # Autenticacion local - cambia estos valores antes de publicar.
  >> ".env" echo # RMC_AUTH_USER=
  >> ".env" echo # RMC_AUTH_PASSWORD=
  >> ".env" echo # RMC_AUTH_SECRET=
)

set "DATABASE_URL=file:./prisma/db/custom.db"

if exist "prisma\schema.prisma" (
  echo Preparando Prisma...
  call npx prisma generate
  if errorlevel 1 (
    echo.
    echo ERROR: No se pudo generar el cliente de Prisma.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo El sistema estara disponible en:
echo   http://localhost:3000
echo.
echo Abriendo navegador...
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:3000'"

echo.
echo Iniciando servidor local...
echo Para detenerlo, cierra esta ventana o presiona Ctrl+C.
echo.

call npm run dev

echo.
echo El servidor se detuvo.
pause

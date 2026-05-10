@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo.
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo Iniciando servidor de desenvolvimento...
echo.
echo O Vite vai mostrar o endereco local e o endereco da rede.
echo Use o endereco Network para acessar por outro dispositivo na mesma rede.
echo.
call npm run dev -- --host 0.0.0.0

if errorlevel 1 (
  echo.
  echo Falha ao iniciar o servidor.
  pause
  exit /b 1
)

endlocal

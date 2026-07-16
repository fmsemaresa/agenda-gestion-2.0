@echo off
chcp 65001 > nul
title Servidor de Agenda, Trabajos y Tareas - Software FM
echo ====================================================================
echo      INICIANDO SERVIDOR LOCAL DE AGENDA, TRABAJOS Y TAREAS
echo ====================================================================
echo.

:: Detectar si existe el entorno virtual
if exist ".venv" goto :start_server

echo [INFO] No se detecto un entorno virtual. Creandolo por primera vez...
echo Esto puede tardar uno o dos minutos...
echo.
python -m venv .venv
if %errorlevel% neq 0 goto :venv_error

echo [INFO] Entorno virtual creado con exito.
echo.
echo [INFO] Instalando dependencias de la aplicacion...
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements.txt
if %errorlevel% neq 0 goto :pip_error

echo [INFO] Dependencias instaladas con exito.
echo.

:start_server
echo [1/2] Iniciando el servicio web en segundo plano...
echo Puerto configurado: 8000 (Local / Seguro)
echo.

:: Liberar el puerto 8000 si está ocupado por procesos anteriores
.venv\Scripts\python free_port.py 8000

:: Abrir el navegador automaticamente en la aplicacion
start "" "http://127.0.0.1:8000"

:: Ejecutar el servidor uvicorn usando el entorno virtual
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
if %errorlevel% neq 0 goto :server_error
goto :eof

:venv_error
echo.
echo [ERROR] No se pudo crear el entorno virtual. 
echo Asegurate de tener Python instalado y agregado a las variables del sistema (PATH).
echo.
pause
exit /b

:pip_error
echo.
echo [ERROR] Ocurrio un error al instalar las dependencias. 
echo Verifica tu conexion a internet y vuelve a intentarlo.
echo.
pause
exit /b

:server_error
echo.
echo [ERROR] Hubo un problema al iniciar el servidor.
echo Asegurate de no tener otro programa usando el puerto 8000.
echo.
pause
exit /b

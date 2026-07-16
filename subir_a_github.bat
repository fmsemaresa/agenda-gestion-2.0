@echo off
chcp 65001 > nul
title Agenda & Gestión 2.0 - Subir a GitHub
echo ====================================================================
echo      ASISTENTE AUTOMÁTICO PARA SUBIR EL PROYECTO A GITHUB
echo ====================================================================
echo.

:: Verificar si Git está instalado y disponible en esta sesión
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git no se encuentra en el sistema o requiere reiniciar el equipo.
    echo Por favor, si acabas de instalar Git, cierra todas las ventanas
    echo y vuelve a abrir este archivo haciendo doble clic sobre él.
    echo.
    pause
    exit /b
)

echo [Paso 1/4] Inicializando repositorio Git local...
git init
git branch -M main
echo.

echo [Paso 2/4] Agregando archivos al repositorio...
git add .
echo.

echo [Paso 3/4] Creando el primer guardado (Commit)...
git commit -m "feat: first release of Agenda & Gestion 2.0 cloud-ready"
echo.

echo ====================================================================
echo        PASO FINAL: VINCULAR CON TU CUENTA DE GITHUB
echo ====================================================================
echo.
echo Instrucciones:
echo 1. Abre tu navegador e ingresa a: https://github.com/new
echo    (Inicia sesión con tu cuenta de GitHub si no lo has hecho).
echo.
echo 2. Crea un repositorio con el nombre: agenda-gestion-2.0
echo    IMPORTANTE: Deja todas las demás opciones como están.
echo    NO marques las casillas de "Add a README", ".gitignore" ni "License".
echo.
echo 3. Haz clic en el botón verde "Create repository".
echo.
echo 4. En la pantalla que aparece, copia la URL que está bajo "HTTPS".
echo    Se ve similar a: https://github.com/tu-usuario/agenda-gestion-2.0.git
echo.
echo ====================================================================
echo.

:ask_url
set /p github_url="PEGA AQUÍ EL ENLACE DE GITHUB (clic derecho para pegar) y presiona Enter: "

if "%github_url%"="" (
    echo [ERROR] No has ingresado ninguna URL. Inténtalo de nuevo.
    goto ask_url
)

echo.
echo Vinculando con GitHub...
git remote remove origin >nul 2>nul
git remote add origin %github_url%

echo.
echo Subiendo código a GitHub...
echo (Si es la primera vez, se abrirá una ventana en tu navegador pidiéndote iniciar sesión en GitHub).
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema al subir el código.
    echo Asegúrate de tener conexión a Internet y que la URL de GitHub sea correcta.
    echo.
) else (
    echo.
    echo ====================================================================
    echo   ¡PROCESO COMPLETADO CON ÉXITO!
    echo   Tu código ya está disponible en tu cuenta de GitHub.
    echo ====================================================================
    echo.
)

pause

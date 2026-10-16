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

echo [Paso 1/3] Preparando repositorio Git local...
git init
git branch -M main
echo.

echo [Paso 2/3] Guardando cambios locales...
git add .
git commit -m "update: fix postgres driver for Render and add Trabajos view"
echo.

echo [Paso 3/3] Sincronizando y subiendo a GitHub...
git remote get-url origin >nul 2>nul
if %errorlevel% equ 0 (
    echo Repositorio remoto detectado: https://github.com/fmsemaresa/agenda-gestion-2.0
    goto :do_push
)

:ask_url
echo.
echo No se detectó un enlace remoto configurado.
set /p github_url="PEGA AQUÍ EL ENLACE DE GITHUB y presiona Enter: "

if "%github_url%"="" (
    echo [ERROR] No has ingresado ninguna URL. Inténtalo de nuevo.
    goto ask_url
)

git remote remove origin >nul 2>nul
git remote add origin %github_url%

:do_push
echo.
echo Subiendo código a GitHub...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema al subir el código.
    echo Asegúrate de tener conexión a Internet y permisos en GitHub.
    echo.
) else (
    echo.
    echo ====================================================================
    echo   ¡PROCESO COMPLETADO CON ÉXITO!
    echo   El código se subió a GitHub y Render desplegará automáticamente.
    echo ====================================================================
    echo.
)

pause

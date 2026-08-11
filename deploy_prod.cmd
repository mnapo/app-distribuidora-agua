@echo off
setlocal enabledelayedexpansion

REM Deploy de AguaDistri en Docker Desktop / Windows.
REM Usa este script cuando MySQL ya existe fuera de este docker-compose.

if "%APP_DIR%"=="" set "APP_DIR=%~dp0"
if "%ENV_FILE%"=="" set "ENV_FILE=%APP_DIR%\.env"
if "%COMPOSE_FILE%"=="" set "COMPOSE_FILE=%APP_DIR%\docker-compose.prod.yml"
if "%PROJECT_NAME%"=="" set "PROJECT_NAME=agua-distri"
if "%NO_CACHE%"=="" set "NO_CACHE=1"
if "%RUN_MIGRATIONS%"=="" set "RUN_MIGRATIONS=1"

echo ==^> Entrando a: %APP_DIR%
cd /d "%APP_DIR%"
if errorlevel 1 exit /b 1

if not exist "%ENV_FILE%" (
  echo ERROR: No existe %ENV_FILE%
  echo Crea el archivo con:
  echo   copy .env.example .env
  echo y configura DATABASE_URL, WEB_ORIGIN, NEXT_PUBLIC_API_URL y las claves JWT.
  exit /b 1
)

set "ENV_FILE=%ENV_FILE%"

echo ==^> Git pull...
git pull
if errorlevel 1 exit /b 1

echo ==^> Validando docker compose ^(api/web, MySQL externo^)...
docker compose --project-name "%PROJECT_NAME%" --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" config >nul
if errorlevel 1 exit /b 1

if "%NO_CACHE%"=="1" (
  echo ==^> Docker build api/web ^(no-cache^)...
  docker compose --project-name "%PROJECT_NAME%" --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" build --no-cache api web
) else (
  echo ==^> Docker build api/web...
  docker compose --project-name "%PROJECT_NAME%" --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" build api web
)
if errorlevel 1 exit /b 1

if "%RUN_MIGRATIONS%"=="1" (
  echo ==^> Aplicando migraciones Prisma...
  docker compose --project-name "%PROJECT_NAME%" --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" run --rm --no-deps api npm run prisma:deploy
  if errorlevel 1 exit /b 1
) else (
  echo ==^> Migraciones omitidas por RUN_MIGRATIONS=0
)

echo ==^> Levantando api/web...
docker compose --project-name "%PROJECT_NAME%" --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" up -d --remove-orphans api web
if errorlevel 1 exit /b 1

echo ==^> Estado:
docker compose --project-name "%PROJECT_NAME%" --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" ps api web

echo ==^> Logs recientes de api:
docker compose --project-name "%PROJECT_NAME%" --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" logs --tail=80 api

echo ==^> Logs recientes de web:
docker compose --project-name "%PROJECT_NAME%" --env-file "%ENV_FILE%" -f "%COMPOSE_FILE%" logs --tail=80 web

echo ==^> OK. Web disponible en WEB_PORT y API disponible en API_HOST_PORT.
endlocal

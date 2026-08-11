#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/AguaDistri}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
PROJECT_NAME="${PROJECT_NAME:-agua-distri}"

export ENV_FILE

echo "==> Entrando a: $APP_DIR"
cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No existe el archivo de variables: $ENV_FILE"
  echo "Copialo desde .env.example y ajusta DATABASE_URL, WEB_ORIGIN y NEXT_PUBLIC_API_URL."
  exit 1
fi

echo "==> Git pull..."
git pull

echo "==> Docker build api/web..."
docker compose \
  --project-name "$PROJECT_NAME" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  build --no-cache api web

echo "==> Aplicando migraciones Prisma..."
docker compose \
  --project-name "$PROJECT_NAME" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  run --rm --no-deps api npm run prisma:deploy

echo "==> Levantando contenedores api/web..."
docker compose \
  --project-name "$PROJECT_NAME" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d --remove-orphans api web

echo "==> OK. Estado de los contenedores:"
docker compose \
  --project-name "$PROJECT_NAME" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  ps

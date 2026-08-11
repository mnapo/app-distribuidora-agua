param(
  [string]$AppDir = "C:\Proyectos\AguaDistri",
  [string]$EnvFile = "",
  [string]$ComposeFile = "",
  [string]$ProjectName = "agua-distri"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $AppDir ".env"
}

if ([string]::IsNullOrWhiteSpace($ComposeFile)) {
  $ComposeFile = Join-Path $AppDir "docker-compose.prod.yml"
}

Write-Host "==> Entrando a: $AppDir"
Set-Location -LiteralPath $AppDir

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Error "No existe el archivo de variables: $EnvFile. Copialo desde .env.example y ajusta DATABASE_URL, WEB_ORIGIN y NEXT_PUBLIC_API_URL."
}

$env:ENV_FILE = $EnvFile

Write-Host "==> Git pull..."
git pull

Write-Host "==> Docker build api/web..."
docker compose `
  --project-name $ProjectName `
  --env-file $EnvFile `
  -f $ComposeFile `
  build --no-cache api web

Write-Host "==> Aplicando migraciones Prisma..."
docker compose `
  --project-name $ProjectName `
  --env-file $EnvFile `
  -f $ComposeFile `
  run --rm --no-deps api npm run prisma:deploy

Write-Host "==> Levantando contenedores api/web..."
docker compose `
  --project-name $ProjectName `
  --env-file $EnvFile `
  -f $ComposeFile `
  up -d --remove-orphans api web

Write-Host "==> OK. Estado de los contenedores:"
docker compose `
  --project-name $ProjectName `
  --env-file $EnvFile `
  -f $ComposeFile `
  ps

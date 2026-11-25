# Liga o backend do WorkAt no seu PC (porta 8080), usando o PostgreSQL local (banco arthub_dev).
# Uso, no terminal do VS Code, a partir da pasta backend:  .\run-local.ps1
# Ele pede a senha do usuário arthub_app do banco (não fica salva em lugar nenhum)
# e gera um segredo de JWT novo a cada vez (por isso é preciso fazer login de novo no site).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$senha = Read-Host -Prompt "Senha do banco (usuário arthub_app)" -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new("", $senha).Password
if (-not $env:DB_URL) { $env:DB_URL = "jdbc:postgresql://localhost:5432/arthub_dev" }
if (-not $env:DB_USERNAME) { $env:DB_USERNAME = "arthub_app" }
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:ARTHUB_DEV_JWT_SECRET = [Convert]::ToBase64String($bytes)

Write-Host "Ligando o backend em http://localhost:8080 (Ctrl+C para parar)..."
mvn spring-boot:run

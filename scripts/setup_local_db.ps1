# scripts/setup_local_db.ps1
# StudyMate AI - Safe Local PostgreSQL Database & Role Setup Script
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    Write-Error "PostgreSQL psql.exe not found at '$psqlPath'."
    exit 1
}

Write-Host "=== StudyMate AI Local Database Setup ===" -ForegroundColor Cyan
Write-Host "This script provisions the dedicated 'studymate_app' role and 'studymate_db' database.`n"

# 1. Prompt for PostgreSQL superuser (postgres) password without echoing
Write-Host "Enter the PostgreSQL 'postgres' superuser password set during installation:" -ForegroundColor Yellow
$superSecure = Read-Host -Prompt "postgres superuser password" -AsSecureString
if ($null -eq $superSecure -or $superSecure.Length -eq 0) {
    Write-Error "Password cannot be empty."
    exit 1
}

$superBstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($superSecure)
try {
    $superPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($superBstr)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($superBstr)
}

# Helper function to run psql queries as postgres superuser
function Invoke-SuperPsql {
    param([string]$query, [string]$dbname = "postgres")
    $oldPass = $env:PGPASSWORD
    $env:PGPASSWORD = $superPass
    try {
        & $psqlPath -U postgres -h 127.0.0.1 -d $dbname -tAc $query
    } finally {
        $env:PGPASSWORD = $oldPass
    }
}

try {
    # Test superuser connection
    Write-Host "`nTesting postgres superuser authentication..." -NoNewline
    $connTest = Invoke-SuperPsql -query "SELECT 1;"
    if ("$connTest".Trim() -ne "1") {
        Write-Error "Failed to authenticate as postgres superuser."
        exit 1
    }
    Write-Host " OK" -ForegroundColor Green

    # 2. Check if role studymate_app exists
    Write-Host "Checking if role 'studymate_app' exists..." -NoNewline
    $roleExists = Invoke-SuperPsql -query "SELECT 1 FROM pg_roles WHERE rolname = 'studymate_app';"
    if ("$roleExists".Trim() -eq "1") {
        Write-Host " Exists" -ForegroundColor Yellow
    } else {
        Write-Host " Not found (will create)" -ForegroundColor Green
    }
    
    # 3. Prompt for the application password
    Write-Host "`nEnter a secure password for the new 'studymate_app' least-privilege role:" -ForegroundColor Yellow
    $appSecure = Read-Host -Prompt "studymate_app password" -AsSecureString
    if ($null -eq $appSecure -or $appSecure.Length -eq 0) {
        Write-Error "Application password cannot be empty."
        exit 1
    }
    $appBstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($appSecure)
    try {
        $appPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($appBstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($appBstr)
    }

    if ("$roleExists".Trim() -eq "1") {
        Write-Host "Role 'studymate_app' already exists. Updating password..." -ForegroundColor Yellow
        $escapedPass = $appPass.Replace("'", "''")
        Invoke-SuperPsql -query "ALTER ROLE studymate_app WITH PASSWORD '$escapedPass';" | Out-Null
    } else {
        Write-Host "Creating role 'studymate_app'..." -ForegroundColor Green
        $escapedPass = $appPass.Replace("'", "''")
        Invoke-SuperPsql -query "CREATE ROLE studymate_app WITH LOGIN PASSWORD '$escapedPass';" | Out-Null
    }

    # 4. Check if database studymate_db exists
    Write-Host "Checking if database 'studymate_db' exists..." -NoNewline
    $dbExists = Invoke-SuperPsql -query "SELECT 1 FROM pg_database WHERE datname = 'studymate_db';"
    if ("$dbExists".Trim() -eq "1") {
        Write-Host " Exists" -ForegroundColor Yellow
    } else {
        Write-Host " Not found (will create)" -ForegroundColor Green
        Invoke-SuperPsql -query "CREATE DATABASE studymate_db OWNER studymate_app;" | Out-Null
    }

    # Grant privileges
    Write-Host "Granting privileges on 'studymate_db'..." -NoNewline
    Invoke-SuperPsql -query "GRANT ALL PRIVILEGES ON DATABASE studymate_db TO studymate_app;" | Out-Null
    Invoke-SuperPsql -dbname "studymate_db" -query "GRANT ALL ON SCHEMA public TO studymate_app;" | Out-Null
    Write-Host " OK" -ForegroundColor Green

    # 5. Configure apps/backend/.env
    $envPath = Join-Path $PSScriptRoot "..\apps\backend\.env"
    $envExamplePath = Join-Path $PSScriptRoot "..\apps\backend\.env.example"

    if (Test-Path $envPath) {
        Write-Host "`n[NOTICE] '$envPath' already exists. Preserving existing .env file." -ForegroundColor Yellow
        Write-Host "Please ensure POSTGRES_PASSWORD in '$envPath' matches your application password." -ForegroundColor Yellow
    } else {
        Write-Host "`nConfiguring '$envPath' from .env.example..." -ForegroundColor Green
        $content = Get-Content $envExamplePath -Raw
        $escapedUrlPass = [System.Uri]::EscapeDataString($appPass)
        $content = $content.Replace('POSTGRES_PASSWORD="your_secure_password_here"', "POSTGRES_PASSWORD=`"$appPass`"")
        $content = $content.Replace('your_secure_password_here@localhost:5432', "$escapedUrlPass@localhost:5432")
        Set-Content -Path $envPath -Value $content -Encoding utf8
        Write-Host "Local .env file created successfully." -ForegroundColor Green
    }

    # 6. Test connection as studymate_app
    Write-Host "`nTesting connection as dedicated role 'studymate_app'..." -NoNewline
    $appOldPass = $env:PGPASSWORD
    $env:PGPASSWORD = $appPass
    try {
        $whoami = & $psqlPath -U studymate_app -h 127.0.0.1 -d studymate_db -tAc "SELECT current_user || '@' || current_database();"
        Write-Host " Connected as: $("$whoami".Trim())" -ForegroundColor Green
    } finally {
        $env:PGPASSWORD = $appOldPass
    }

    Write-Host "`n=== Database Setup Completed Successfully! ===" -ForegroundColor Green
} finally {
    # Zero out sensitive variables from memory
    $superPass = $null
    $appPass = $null
    $env:PGPASSWORD = $null
    [System.GC]::Collect()
}

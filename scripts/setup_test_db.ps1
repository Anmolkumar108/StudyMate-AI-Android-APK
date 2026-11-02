# scripts/setup_test_db.ps1
# StudyMate AI - Dedicated PostgreSQL Test Database Setup Script
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    Write-Error "PostgreSQL psql.exe not found at '$psqlPath'."
    exit 1
}

Write-Host "=== StudyMate AI Integration Test Database Setup ===" -ForegroundColor Cyan
Write-Host "This script provisions the dedicated 'studymate_test_db' database owned by 'studymate_app'.`n"

# 1. Prompt for PostgreSQL superuser (postgres) password securely without echoing
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

function Invoke-SuperPsql {
    param([string]$query, [string]$dbname = "postgres")
    $oldPass = $env:PGPASSWORD
    $env:PGPASSWORD = $superPass
    try {
        $output = & $psqlPath -U postgres -h 127.0.0.1 -d $dbname -tAc $query
        if ($LASTEXITCODE -ne 0) {
            Write-Error "PostgreSQL command failed with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
        $output
    } finally {
        $env:PGPASSWORD = $oldPass
    }
}

try {
    # 2. Test superuser connection
    Write-Host "`nTesting postgres superuser authentication..." -NoNewline
    $connTest = Invoke-SuperPsql -query "SELECT 1;"
    if ("$connTest".Trim() -ne "1") {
        Write-Error "Failed to authenticate as postgres superuser."
        exit 1
    }
    Write-Host " OK" -ForegroundColor Green

    # 3. Verify role studymate_app exists
    Write-Host "Verifying dedicated role 'studymate_app' exists..." -NoNewline
    $roleExists = Invoke-SuperPsql -query "SELECT 1 FROM pg_roles WHERE rolname = 'studymate_app';"
    if ("$roleExists".Trim() -ne "1") {
        Write-Error "Role 'studymate_app' not found. Please run scripts/setup_local_db.ps1 first."
        exit 1
    }
    Write-Host " Exists" -ForegroundColor Green

    # 4. Check if database studymate_test_db exists
    Write-Host "Checking if database 'studymate_test_db' exists..." -NoNewline
    $dbExists = Invoke-SuperPsql -query "SELECT 1 FROM pg_database WHERE datname = 'studymate_test_db';"
    if ("$dbExists".Trim() -eq "1") {
        Write-Host " Exists" -ForegroundColor Yellow
    } else {
        Write-Host " Not found (creating)" -ForegroundColor Green
        Invoke-SuperPsql -query "CREATE DATABASE studymate_test_db OWNER studymate_app;" | Out-Null
        Write-Host "Created 'studymate_test_db' successfully." -ForegroundColor Green
    }

    # 5. Grant least-privilege permissions on studymate_test_db
    Write-Host "Granting permissions on 'studymate_test_db' to 'studymate_app'..." -NoNewline
    Invoke-SuperPsql -query "GRANT ALL PRIVILEGES ON DATABASE studymate_test_db TO studymate_app;" | Out-Null
    Invoke-SuperPsql -dbname "studymate_test_db" -query "GRANT ALL ON SCHEMA public TO studymate_app;" | Out-Null
    Write-Host " OK" -ForegroundColor Green

    # 6. Apply Alembic migration to studymate_test_db
    Write-Host "`nApplying Alembic migration to 'studymate_test_db'..." -ForegroundColor Cyan
    $backendDir = Resolve-Path (Join-Path $PSScriptRoot "..\apps\backend")
    $venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"

    if (Test-Path $venvPython) {
        Push-Location $backendDir
        $oldDbUrl = $env:DATABASE_URL
        try {
            $env:PYTHONPATH = "$backendDir"
            $env:DATABASE_URL = $null
            & $venvPython -c "import sys; from pathlib import Path; sys.path.insert(0, str(Path.cwd())); from tests.db_test_config import apply_test_migrations, resolve_test_database_url; apply_test_migrations(resolve_test_database_url())"
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Alembic migration failed on 'studymate_test_db' with exit code $LASTEXITCODE."
                exit $LASTEXITCODE
            }
        } finally {
            $env:DATABASE_URL = $oldDbUrl
            Pop-Location
        }
        Write-Host "Alembic migration applied successfully to 'studymate_test_db'." -ForegroundColor Green
    } else {
        Write-Error "Python virtualenv not found at '$venvPython'."
        exit 1
    }

    Write-Host "`n=== Test Database Setup Completed Successfully! ===" -ForegroundColor Green
    Write-Host "You can now run integration tests with:" -ForegroundColor Cyan
    Write-Host "  `$env:RUN_POSTGRES_INTEGRATION = `"1`"; pytest -v -m integration" -ForegroundColor White
} finally {
    $superPass = $null
    $env:PGPASSWORD = $null
    [System.GC]::Collect()
}

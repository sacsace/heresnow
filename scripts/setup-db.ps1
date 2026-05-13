<#!
  PostgreSQL에 `herenow` DB를 만들고, .env 의 DATABASE_URL 만 갱신(기존 AUTH_SECRET 등 유지)한 뒤
  Prisma migrate deploy + seed 를 실행합니다.

  사용 예:
    .\scripts\setup-db.ps1 -PostgresPassword '설치시_지정한_postgres_비밀번호'
    .\scripts\setup-db.ps1 -PostgresPassword '...' -PostgresUser 'postgres' -PostgresHost '127.0.0.1' -Port 5432
#>
param(
  [Parameter(Mandatory = $false)]
  [string] $PostgresPassword = "",
  [string] $PostgresUser = "postgres",
  [string] $PostgresHost = "127.0.0.1",
  [int] $Port = 5432,
  [string] $DatabaseName = "herenow"
)

$ErrorActionPreference = "Stop"

$psqlCandidates = @(
  "C:\Program Files\PostgreSQL\18\bin\psql.exe",
  "C:\Program Files\PostgreSQL\17\bin\psql.exe",
  "C:\Program Files\PostgreSQL\16\bin\psql.exe"
)
$psql = $psqlCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $psql) {
  $found = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object { $_.Directory.Parent.Name } -Descending |
    Select-Object -First 1
  if ($found) { $psql = $found.FullName }
}
if (-not $psql) {
  throw "psql.exe를 찾을 수 없습니다. PostgreSQL bin 경로를 PATH에 추가하세요."
}

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
  throw "package.json을 찾을 수 없습니다. 경로: $ProjectRoot"
}

if ([string]::IsNullOrWhiteSpace($PostgresPassword) -and $env:POSTGRES_PASSWORD) {
  $PostgresPassword = $env:POSTGRES_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($PostgresPassword)) {
  throw "PostgreSQL 비밀번호가 필요합니다. 예: -PostgresPassword '비밀번호' 또는 환경 변수 POSTGRES_PASSWORD 설정"
}

$env:PGPASSWORD = $PostgresPassword

Write-Host "연결 확인: ${PostgresUser}@${PostgresHost}:${Port} ..."
& $psql -U $PostgresUser -h $PostgresHost -p $Port -d postgres -v ON_ERROR_STOP=1 -c "SELECT 1;" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL 연결/인증 실패. 설치 시 지정한 postgres 사용자 비밀번호를 -PostgresPassword 로 전달하세요."
}

if ($DatabaseName -notmatch '^[a-zA-Z_][a-zA-Z0-9_]*$') {
  throw "데이터베이스 이름은 영문/숫자/밑줄만 사용하세요."
}
$existsRaw = & $psql -U $PostgresUser -h $PostgresHost -p $Port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';" 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "데이터베이스 목록 조회 실패."
}
$exists = ($existsRaw | Out-String).Trim()
if ($exists -eq "1") {
  Write-Host "데이터베이스 '$DatabaseName' 이미 존재합니다."
}
else {
  Write-Host "데이터베이스 '$DatabaseName' 생성 중..."
  & $psql -U $PostgresUser -h $PostgresHost -p $Port -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DatabaseName;"
  Write-Host "생성 완료."
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

$enc = [System.Uri]::EscapeDataString($PostgresPassword)
$dbUrl = "postgresql://${PostgresUser}:${enc}@${PostgresHost}:${Port}/${DatabaseName}?schema=public"

$envPath = Join-Path $ProjectRoot ".env"
$newDatabaseLine = "DATABASE_URL=`"$dbUrl`""

if (Test-Path $envPath) {
  $lines = Get-Content -Path $envPath -Encoding utf8
  $out = [System.Collections.ArrayList]@()
  $replaced = $false
  foreach ($line in $lines) {
    if ($line -match '^\s*DATABASE_URL\s*=') {
      [void]$out.Add($newDatabaseLine)
      $replaced = $true
    }
    else {
      [void]$out.Add($line)
    }
  }
  if (-not $replaced) {
    if ($out.Count -gt 0 -and $out[$out.Count - 1] -ne "") { [void]$out.Add("") }
    [void]$out.Add("# DATABASE_URL (setup-db.ps1)")
    [void]$out.Add($newDatabaseLine)
  }
  $hasAuth = $false
  foreach ($line in $out) {
    if ($line -match '^\s*AUTH_SECRET\s*=') { $hasAuth = $true; break }
  }
  if (-not $hasAuth) {
    $authSecret = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
    if ($out.Count -gt 0 -and $out[$out.Count - 1] -ne "") { [void]$out.Add("") }
    [void]$out.Add("AUTH_SECRET=`"$authSecret`"")
    [void]$out.Add("AUTH_URL=`"http://localhost:3000`"")
  }
  Set-Content -Path $envPath -Value ($out -join "`r`n") -Encoding utf8
  Write-Host ".env 갱신: DATABASE_URL 만 반영, AUTH_* 등 기존 줄 유지 — $envPath"
}
else {
  $authSecret = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  $envLines = @(
    "# 자동 생성됨 (scripts/setup-db.ps1)",
    $newDatabaseLine,
    "AUTH_SECRET=`"$authSecret`"",
    "AUTH_URL=`"http://localhost:3000`"",
    "",
    "NEXT_PUBLIC_GOOGLE_MAPS_KEY=`"`""
  )
  Set-Content -Path $envPath -Value ($envLines -join "`r`n") -Encoding utf8
  Write-Host ".env 새로 작성: $envPath"
}

Push-Location $ProjectRoot
try {
  Write-Host "Prisma migrate deploy..."
  npx prisma migrate deploy
  Write-Host "Prisma seed..."
  npx prisma db seed
  Write-Host ""
  Write-Host "준비 완료. npm run dev"
}
finally {
  Pop-Location
}

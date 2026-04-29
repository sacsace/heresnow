<#!
  PostgreSQL에 `herenow` DB를 만들고, .env를 구성한 뒤 Prisma push + seed까지 실행합니다.

  사용 예:
    .\scripts\setup-db.ps1 -PostgresPassword '비밀번호'
    .\scripts\setup-db.ps1 -PostgresPassword '비밀번호' -PostgresUser 'postgres' -Port 5432
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $PostgresPassword,
  [string] $PostgresUser = "postgres",
  [string] $Host = "127.0.0.1",
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
  throw "psql.exe를 찾을 수 없습니다. PostgreSQL bin 경로를 PATH에 추가하거나 스크립트 내 경로를 수정하세요."
}

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
  throw "package.json을 찾을 수 없습니다. 경로: $ProjectRoot"
}

$env:PGPASSWORD = $PostgresPassword

Write-Host "연결 확인: ${PostgresUser}@${Host}:${Port} ..."
& $psql -U $PostgresUser -h $Host -p $Port -d postgres -v ON_ERROR_STOP=1 -c "SELECT 1;" | Out-Null

if ($DatabaseName -notmatch '^[a-zA-Z_][a-zA-Z0-9_]*$') {
  throw "데이터베이스 이름은 영문/숫자/밑줄만 사용하세요."
}
$exists = (& $psql -U $PostgresUser -h $Host -p $Port -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';").Trim()
if ($exists -eq "1") {
  Write-Host "데이터베이스 '$DatabaseName' 이미 존재합니다."
}
else {
  Write-Host "데이터베이스 '$DatabaseName' 생성 중..."
  & $psql -U $PostgresUser -h $Host -p $Port -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DatabaseName;"
  Write-Host "생성 완료."
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

$enc = [System.Uri]::EscapeDataString($PostgresPassword)
$dbUrl = "postgresql://${PostgresUser}:${enc}@${Host}:${Port}/${DatabaseName}?schema=public"

$authSecret = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
$envPath = Join-Path $ProjectRoot ".env"
$envLines = @(
  "# 자동 생성됨 (scripts/setup-db.ps1)",
  "DATABASE_URL=`"$dbUrl`"",
  "AUTH_SECRET=`"$authSecret`"",
  "AUTH_URL=`"http://localhost:3000`"",
  "",
  "# 선택: 관리자 지도",
  "NEXT_PUBLIC_GOOGLE_MAPS_KEY=`"`""
)

Set-Content -Path $envPath -Value ($envLines -join "`r`n") -Encoding utf8
Write-Host ".env 저장: $envPath"

Push-Location $ProjectRoot
try {
  Write-Host "Prisma db push..."
  npx prisma db push
  Write-Host "Prisma seed..."
  npx prisma db seed
  Write-Host ""
  Write-Host "준비 완료. 다음으로 실행: npm run dev"
}
finally {
  Pop-Location
}

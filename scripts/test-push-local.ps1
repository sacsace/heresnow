# HeresNow Web Push 로컬 가상 테스트 (PowerShell)
# 사용 전: npm run dev 실행, .env에 VAPID_* / CRON_SECRET 설정

$BaseUrl = if ($env:AUTH_URL) { $env:AUTH_URL.TrimEnd("/") } else { "http://localhost:3010" }
$CronSecret = $env:CRON_SECRET

Write-Host "=== HeresNow Push local test ===" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl"
Write-Host ""

Write-Host "1) VAPID 키 없으면: npm run vapid:generate" -ForegroundColor Yellow
Write-Host "2) 브라우저(Chrome)에서 로그인 -> 내 계정 -> 출근 알림 켜기"
Write-Host "3) DevTools Console에서 테스트 푸시:"
Write-Host '   fetch("/api/dev/push-test",{method:"POST"}).then(r=>r.json()).then(console.log)' -ForegroundColor Green
Write-Host ""

if ($CronSecret) {
  Write-Host "4) 운영과 동일한 크론 API (Bearer CRON_SECRET):" -ForegroundColor Yellow
  Write-Host "   curl -X POST `"$BaseUrl/api/cron/check-in-reminders`" -H `"Authorization: Bearer $CronSecret`""
  Write-Host ""
}

Write-Host "5) 개발 전용 크론 (로그인 세션 쿠키 필요 — 브라우저 Console 권장):" -ForegroundColor Yellow
Write-Host '   fetch("/api/dev/check-in-reminders",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}).then(r=>r.json()).then(console.log)' -ForegroundColor Green
Write-Host ""
Write-Host "±15분 윈도우 테스트: 직원 출근 시각을 현재+16분으로 맞춘 뒤 4) 또는 5) 실행" -ForegroundColor Yellow

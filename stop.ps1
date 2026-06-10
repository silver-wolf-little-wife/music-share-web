$ErrorActionPreference = "Continue"
$port = 3000

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Music Share Web - 关闭服务器" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if (-not $connection) {
    Write-Host "[INFO] 端口 $port 未被占用，服务器可能已关闭" -ForegroundColor Yellow
} else {
    $pid = $connection.OwningProcess
    Write-Host "[INFO] 找到进程 PID: $pid，正在关闭..." -ForegroundColor Yellow
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    if ($?) {
        Write-Host "[OK] 服务器已关闭" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] 关闭失败，请手动终止 PID $pid" -ForegroundColor Red
    }
}

Write-Host ""
Read-Host "按 Enter 退出"

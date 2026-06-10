$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Music Share Web - 一键启动脚本" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
$nodeVersion = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $nodeVersion) {
    Write-Host "[ERROR] 未找到 Node.js，请先安装" -ForegroundColor Red
    Write-Host "        下载地址: https://nodejs.org/"
    Read-Host "按 Enter 退出"
    exit 1
}
Write-Host "[OK] Node.js 已安装" -ForegroundColor Green

# 安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] 正在安装依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] 依赖安装失败" -ForegroundColor Red
        Read-Host "按 Enter 退出"
        exit 1
    }
} else {
    Write-Host "[OK] 依赖已安装" -ForegroundColor Green
}

# 检查/创建 .env
if (-not (Test-Path ".env")) {
    Write-Host "[INFO] 创建默认 .env 配置..." -ForegroundColor Yellow
    @"
PORT=3000
NODE_ENV=production
SESSION_SECRET=music-share-secret-key-change-me
"@ | Out-File -FilePath .env -Encoding UTF8
}
Write-Host "[OK] .env 配置就绪" -ForegroundColor Green

# 创建必要目录
@("music", "public\covers") | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
        Write-Host "[INFO] 创建目录: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "正在启动服务器..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 启动
node app.js

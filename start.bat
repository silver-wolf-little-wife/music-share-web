@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Music Share Web - 一键启动脚本
echo ============================================
echo.

REM 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 未找到 Node.js，请先安装 Node.js
    echo         下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js 已安装

REM 安装依赖
if not exist "node_modules\" (
    echo [INFO] 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [OK] 依赖已安装
)

REM 检查 .env 配置
if not exist ".env" (
    echo [INFO] 创建默认 .env 配置...
    (
        echo PORT=3000
        echo NODE_ENV=production
        echo SESSION_SECRET=music-share-secret-key-change-me
    ) > .env
)
echo [OK] .env 配置就绪

REM 创建必要目录
if not exist "music\" mkdir music
if not exist "public\covers\" mkdir public\covers

echo.
echo 正在启动服务器...
echo ============================================
echo.

REM 启动服务器
node app.js

pause

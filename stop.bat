@echo off
chcp 65001 >nul

echo ============================================
echo   Music Share Web - 关闭服务器
echo ============================================
echo.

set PORT=3000

REM 查找占用端口的 PID
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set PID=%%a
    goto :kill
)

echo [INFO] 端口 %PORT% 未被占用，服务器可能已关闭
goto :end

:kill
echo [INFO] 找到进程 PID: %PID%，正在关闭...
taskkill /PID %PID% /F >nul 2>&1

if %errorlevel% equ 0 (
    echo [OK] 服务器已关闭
) else (
    echo [ERROR] 关闭失败，请手动终止 PID %PID%
)

:end
echo.
pause

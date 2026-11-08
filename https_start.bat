@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   启课 · HTTPS 局域网启动（★47）
echo ============================================================
echo.
echo   说明：
echo   - 本脚本生成本机自签证书，仅适合局域网 / 校园网自用；
echo     浏览器会提示「不安全」，属正常现象，可手动继续访问。
echo   - 真正公网使用请申请域名 + 正式证书（或走反向代理 / 内网穿透），
echo     务必保持 HTTPS，不要用 HTTP 明文传密码。
echo   - 内网穿透可用 Cloudflare Tunnel / frp / ngrok 等工具把本机
echo     端口映射出去；映射后仍需 HTTPS 与强密码。
echo   - 只想本机使用：直接运行 start.bat（HTTP 127.0.0.1）。
echo.

set "PY=C:\Program Files\Python314\python.exe"
if not exist "%PY%" set "PY=python"
if not exist "data" mkdir data

set "SSL_EXE="
where openssl >nul 2>nul && set "SSL_EXE=openssl"
if not defined SSL_EXE if exist "C:\Program Files\Git\usr\bin\openssl.exe" set "SSL_EXE=C:\Program Files\Git\usr\bin\openssl.exe"
if not defined SSL_EXE (
  echo [提示] 未找到 openssl，无法自动生成自签证书。
  echo        安装 Git for Windows 后重跑，或准备好证书后手动设置：
  echo          set QIKE_SSL_CERT=证书.pem
  echo          set QIKE_SSL_KEY=私钥.pem
  echo          set QIKE_HTTPS=1
  echo          set QIKE_HOST=0.0.0.0
  echo        再运行 start.bat
  pause
  exit /b 1
)

if not exist "data\cert.pem" (
  echo 正在生成自签证书…
  "%SSL_EXE%" req -x509 -newkey rsa:2048 -nodes -keyout "data\key.pem" -out "data\cert.pem" -days 365 -subj "/CN=qike.local" >nul 2>&1
  if not exist "data\cert.pem" (
    echo [失败] 证书生成失败，请检查 openssl 是否可用。
    pause
    exit /b 1
  )
  echo 证书已生成： data\cert.pem / data\key.pem
)

set "QIKE_SSL_CERT=%CD%\data\cert.pem"
set "QIKE_SSL_KEY=%CD%\data\key.pem"
set "QIKE_HTTPS=1"
set "QIKE_HOST=0.0.0.0"
echo.
echo 启动地址： https://127.0.0.1:5173
echo 同一网络的学生可用： https://^<本机IP^>:5173
echo 关闭此窗口即停止服务
echo.
"%PY%" app.py
pause

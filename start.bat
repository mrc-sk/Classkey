@echo off
chcp 65001 >nul
cd /d "%~dp0"
set QIKE_HOST=0.0.0.0
set QIKE_PORT=5173
echo.
echo   启课 - 师生作业与成绩平台
echo   ------------------------------------------
echo   本机访问   : http://127.0.0.1:%QIKE_PORT%
echo   局域网访问 : http://^<本机IP^>:%QIKE_PORT%
echo               (命令行输入 ipconfig 查看本机 IP)
echo   只想本机使用：把本文件里的 QIKE_HOST 改成 127.0.0.1
echo   忘记老师密码：python reset_teacher.py 你的邮箱
echo   走 HTTPS 时：再加一行 set QIKE_HTTPS=1
echo   关闭此窗口即停止服务
echo.
"C:\Program Files\Python314\python.exe" app.py
pause

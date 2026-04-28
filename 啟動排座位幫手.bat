@echo off
start cmd /k "pushd %~dp0 && npm run dev"
timeout /t 3 >nul
start http://localhost:5173
echo.
echo ==================================================
echo  Server is running in the other CMD window.
echo  To STOP: close the other black window (npm).
echo  Press any key to close THIS window...
echo ==================================================
pause >nul

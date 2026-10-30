@echo off
rem ===== VOID: run backend + frontend with one command =====
setlocal
set ROOT=%~dp0

echo [VOID 1/3] Preparing backend...
if not exist "%ROOT%backend\.venv" (
  echo First run: creating Python virtual environment...
  python -m venv "%ROOT%backend\.venv"
  if errorlevel 1 goto :fail
)
"%ROOT%backend\.venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r "%ROOT%backend\requirements.txt"
if errorlevel 1 goto :fail
if not exist "%ROOT%backend\.env" copy "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul

echo [VOID 2/3] Preparing frontend...
pushd "%ROOT%frontend"
if errorlevel 1 goto :fail
if not exist node_modules (
  echo First run: installing npm dependencies, this may take a few minutes...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    popd
    goto :fail
  )
)
popd

echo [VOID 3/3] Starting backend and frontend. To stop VOID, close those windows.
start "VOID backend" cmd /k "cd /d %ROOT%backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
start "VOID frontend" cmd /k "cd /d %ROOT%frontend && npm run dev"

echo.
echo [VOID] Backend: http://localhost:8000/docs    Frontend: http://localhost:5173
echo You can close this window.
timeout /t 5 /nobreak >nul
start "" http://localhost:5173
exit /b 0

:fail
echo.
echo [VOID] Startup failed. Check that Python 3.10+ and Node.js 18+ are installed.
pause
exit /b 1

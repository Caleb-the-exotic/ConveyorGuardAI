@echo off
cd /d "%~dp0"
echo Starting ConveyorGuard FastAPI Backend...
"C:\Users\Aarthy\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
pause

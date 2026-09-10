Set-Location $PSScriptRoot
Write-Host "Starting ConveyorGuard FastAPI Backend..." -ForegroundColor Cyan
& "C:\Users\Aarthy\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload

# PolyGreeks dev startup
# Starts the FastAPI backend and Vite frontend in separate windows.

$root = $PSScriptRoot

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  cd '$root';
  Write-Host 'Starting PolyGreeks API...' -ForegroundColor Cyan;
  uv run uvicorn server:app --reload --port 8000
"

# Frontend — install deps if node_modules is missing, then start
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  cd '$root\frontend';
  if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing frontend dependencies...' -ForegroundColor Yellow;
    npm install
  };
  Write-Host 'Starting Vite frontend...' -ForegroundColor Cyan;
  npm run dev
"

Write-Host ""
Write-Host "PolyGreeks starting up:" -ForegroundColor Green
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor White
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "Close the two terminal windows to stop." -ForegroundColor DarkGray

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

param([switch]$Dashboard)

if ($Dashboard) {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "
    cd '$root';
    Write-Host 'Starting Streamlit dashboard...' -ForegroundColor Magenta;
    uv run streamlit run dashboard.py --server.port 8501
  "
}

Write-Host ""
Write-Host "PolyGreeks starting up:" -ForegroundColor Green
Write-Host "  Frontend  -> http://localhost:5173" -ForegroundColor White
Write-Host "  Backend   -> http://localhost:8000" -ForegroundColor White
if ($Dashboard) {
  Write-Host "  Dashboard -> http://localhost:8501" -ForegroundColor Magenta
}
Write-Host ""
Write-Host "Close the terminal windows to stop." -ForegroundColor DarkGray

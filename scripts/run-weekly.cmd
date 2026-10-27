@echo off
cd /d "D:\CHOSN\chosn"
docker info >nul 2>&1 || (start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" & timeout /t 90 /nobreak >nul & docker compose up -d)
"C:\Python313\python.exe" scripts\webscraper\run.py all 

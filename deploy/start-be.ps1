<#
.SYNOPSIS
  Bật toàn bộ backend PRN_ASM ở local bằng Docker Compose (Postgres, Redis, Kafka, 4 service, Envoy).

.DESCRIPTION
  - Kiểm tra Docker Desktop đã chạy chưa (nếu chưa thì báo và thoát).
  - `docker compose up -d` (+ `--build` trừ khi truyền -NoBuild).
  - Chờ tới khi gateway :18080 và web :5173 trả lời được rồi in bảng URL.

.EXAMPLE
  pwsh -File deploy/start-be.ps1

.EXAMPLE
  pwsh -File deploy/start-be.ps1 -NoBuild     # dùng image đã build sẵn, khởi động nhanh
#>
[CmdletBinding()]
param(
    [switch]$NoBuild,
    [int]$TimeoutSeconds = 420
)

$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $server = docker version --format '{{.Server.Version}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $server) {
        throw 'Docker Desktop chưa chạy. Mở Docker Desktop, đợi engine xanh rồi chạy lại script này.'
    }
    Write-Host "[docker] engine $server" -ForegroundColor DarkGray

    $composeArgs = @('compose', 'up', '-d')
    if (-not $NoBuild) { $composeArgs += '--build' }

    Write-Host "[docker] docker $($composeArgs -join ' ')  (lần đầu có thể mất vài phút)" -ForegroundColor Cyan
    & docker @composeArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose up thất bại (exit $LASTEXITCODE)" }

    function Test-Port([int]$Port) {
        try {
            $c = New-Object System.Net.Sockets.TcpClient
            $c.Connect('127.0.0.1', $Port)
            $c.Close()
            return $true
        } catch { return $false }
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ((Test-Port 18080) -and (Test-Port 5173)) { break }
        Start-Sleep -Seconds 3
    }

    & docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'

    $gw = Test-Port 18080
    $web = Test-Port 5173
    Write-Host ''
    Write-Host '===== URL local =====' -ForegroundColor Green
    Write-Host ("  Web app      : http://localhost:5173   {0}" -f $(if ($web) { '[OK]' } else { '[CHƯA SẴN SÀNG]' }))
    Write-Host ("  Envoy gateway: http://localhost:18080  {0}" -f $(if ($gw) { '[OK]' } else { '[CHƯA SẴN SÀNG]' }))
    Write-Host '  Postgres     : localhost:5432  (postgres / postgres)'
    Write-Host '  Kafka        : localhost:9092'
    Write-Host '  Redis        : localhost:6379'
    Write-Host ''
    Write-Host 'Mở tunnel công khai:  pwsh -File deploy/quick-tunnel.ps1' -ForegroundColor Cyan
    Write-Host '  (script in sẵn link demo: https://<vercel-app>/?api=https://<tunnel>.trycloudflare.com)' -ForegroundColor DarkGray
    Write-Host 'Xem log 1 service   :  docker compose logs -f game-service' -ForegroundColor DarkGray
}
finally {
    Pop-Location
}

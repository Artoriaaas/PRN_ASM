<#
.SYNOPSIS
  Mở Cloudflare Quick Tunnel (trycloudflare.com) trỏ tới app PRN_ASM đang chạy local,
  rồi in luôn link demo Vercel kèm `?api=<tunnel>` để copy 1 dòng là chạy.

.DESCRIPTION
  - Tự tải cloudflared vào %LOCALAPPDATA%\cloudflared nếu máy chưa có.
  - Mặc định tunnel tới http://localhost:5173 (container web: UI + proxy /sudoku.*, /api, /hubs).
  - Dùng -Port 18080 nếu chỉ muốn public Envoy Gateway (API-only).
  - Đọc URL tunnel từ log cloudflared rồi in:
      https://<vercel-app>/?api=https://<random-words>.trycloudflare.com
    (frontend resolve base URL lúc runtime — xem clients/src/api/apiBase.ts).
  - Vẫn stream log cloudflared ra console; Ctrl+C để tắt tunnel.

.PARAMETER VercelUrl
  Domain frontend trên Vercel để ghép link demo. Mặc định lấy env PRN_ASM_VERCEL_URL,
  nếu không có thì dùng https://sudokumultimode.vercel.app

.EXAMPLE
  pwsh -File deploy/quick-tunnel.ps1

.EXAMPLE
  pwsh -File deploy/quick-tunnel.ps1 -Port 18080

.EXAMPLE
  pwsh -File deploy/quick-tunnel.ps1 -VercelUrl https://my-app.vercel.app

.NOTES
  URL dạng https://<random-words>.trycloudflare.com sẽ đổi mỗi lần chạy (quick tunnel là tạm thời,
  không cần tài khoản Cloudflare). Link demo in ra chỉ cần mở 1 lần: FE lưu `?api=` vào localStorage
  nên các lần sau mở link gốc vẫn đúng tunnel. Xoá override bằng `?api=reset`.
#>
[CmdletBinding()]
param(
    [int]$Port = 5173,
    [string]$HostName = 'localhost',
    [string]$VercelUrl,
    [int]$WaitSeconds = 60
)

$ErrorActionPreference = 'Stop'

if (-not $VercelUrl) { $VercelUrl = $env:PRN_ASM_VERCEL_URL }
if (-not $VercelUrl) { $VercelUrl = 'https://sudokumultimode.vercel.app' }
$VercelUrl = $VercelUrl.TrimEnd('/')

$exe = Join-Path $env:LOCALAPPDATA 'cloudflared\cloudflared.exe'
if (-not (Test-Path $exe)) {
    Write-Host '[cloudflared] chưa có, đang tải bản mới nhất...' -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path (Split-Path $exe) | Out-Null
    Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $exe -UseBasicParsing
    Write-Host "[cloudflared] đã tải: $exe" -ForegroundColor Green
}

if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
    Write-Warning "Không có process nào listen trên ${HostName}:$Port. Hãy bật app trước (deploy/start-be.ps1) rồi chạy lại."
}

# cloudflared ghi log ra stderr -> redirect vào file để đọc URL, rồi tail lại cho người dùng xem.
$stamp = [guid]::NewGuid().ToString('N')
$errLog = Join-Path $env:TEMP "prn-asm-tunnel-$stamp.err.log"
$outLog = Join-Path $env:TEMP "prn-asm-tunnel-$stamp.out.log"
$cfArgs = @('tunnel', '--url', "http://${HostName}:$Port", '--no-autoupdate')

function Get-TunnelLog {
    $text = ''
    foreach ($file in @($errLog, $outLog)) {
        if (Test-Path $file) {
            try { $text += (Get-Content -Path $file -Raw -ErrorAction Stop) } catch { }
        }
    }
    return $text
}

Write-Host "[tunnel] http://${HostName}:$Port  ->  https://<random>.trycloudflare.com" -ForegroundColor Cyan
$proc = Start-Process -FilePath $exe -ArgumentList $cfArgs -NoNewWindow -PassThru `
    -RedirectStandardError $errLog -RedirectStandardOutput $outLog

try {
    $url = $null
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $match = [regex]::Match((Get-TunnelLog), 'https://[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com')
        if ($match.Success) { $url = $match.Value; break }
        if ($proc.HasExited) { break }
        Start-Sleep -Milliseconds 700
    }

    if ($url) {
        Write-Host ''
        Write-Host '==================== LINK DEMO ====================' -ForegroundColor Green
        Write-Host "  Tunnel (API + SignalR) : $url"
        Write-Host "  Web local              : http://localhost:$Port"
        Write-Host ''
        Write-Host '  Copy đúng 1 dòng dưới đây để mở app Vercel:' -ForegroundColor DarkGray
        Write-Host "  $VercelUrl/?api=$url" -ForegroundColor Green
        Write-Host ''
        Write-Host "  Xoá override (về VITE_API_URL) : $VercelUrl/?api=reset" -ForegroundColor DarkGray
        Write-Host '==================================================' -ForegroundColor Green
    }
    else {
        Write-Warning "Không đọc được URL tunnel sau ${WaitSeconds}s. Log cloudflared:"
        Write-Host (Get-TunnelLog)
    }

    Write-Host '[tunnel] Đang chạy... Ctrl+C để tắt tunnel.' -ForegroundColor DarkGray
    Get-Content -Path $errLog -Wait -Tail 20
}
finally {
    if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item $errLog, $outLog -Force -ErrorAction SilentlyContinue
}

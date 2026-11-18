#Requires -Version 7.0
<#
.SYNOPSIS
    Đọc log container PRN_ASM và gộp các dòng bị tách (EF Core SQL, stack trace) thành 1 block.

.DESCRIPTION
    Formatter console mặc định của .NET in mỗi log record thành nhiều dòng vật lý, nên `docker logs`
    hiển thị 1 câu SELECT thành 7 dòng rời rạc. Script này gom lại theo header
    `info: Category[EventId]` để đọc/dò log dễ hơn.

.EXAMPLE
    ./deploy/logs.ps1 -Service game-service -Tail 300

.EXAMPLE
    # Chỉ xem SQL do EF Core sinh ra, mỗi câu 1 dòng
    ./deploy/logs.ps1 -Service game-service -Tail 500 -Sql

.EXAMPLE
    # Theo dõi realtime, chỉ lấy block có chứa chuỗi khớp regex
    ./deploy/logs.ps1 -Service game-service -Follow -Filter 'game_sessions|Started game session'

.EXAMPLE
    # Xem log 10 phút gần nhất của mọi service
    ./deploy/logs.ps1 -Service game-service -Since 10m -Tail 0 -Follow
#>
[CmdletBinding()]
param(
    # Tên ngắn (game-service) hoặc tên container đầy đủ (prn-asm-game-service-1)
    [Parameter(Position = 0)]
    [string]$Service = 'game-service',

    # Số dòng log thô lấy từ docker (tính theo dòng vật lý, không phải theo record)
    [int]$Tail = 200,

    # Theo dõi realtime (docker logs -f)
    [switch]$Follow,

    # Khoảng thời gian, ví dụ 10m / 2h / 2026-11-18T10:00:00
    [string]$Since,

    # Lọc theo regex trên toàn bộ nội dung block (sau khi gộp)
    [string]$Filter,

    # Chỉ hiện log Microsoft.EntityFrameworkCore.Database.Command
    [switch]$Sql,

    # Gộp cả message thành 1 dòng duy nhất (tiện grep)
    [switch]$Compact,

    # Hiện timestamp của docker ở đầu mỗi block
    [switch]$Timestamps,

    # Không tô màu (khi redirect ra file)
    [switch]$NoColor
)

$ErrorActionPreference = 'Stop'

function Resolve-Container {
    param([string]$Name)

    $names = @(docker ps --format '{{.Names}}')
    if ($names -contains $Name) { return $Name }
    if ($names -contains "prn-asm-$Name-1") { return "prn-asm-$Name-1" }
    if ($names -contains "prn-asm-$Name") { return "prn-asm-$Name" }

    $fuzzy = $names | Where-Object { $_ -like "*$Name*" } | Select-Object -First 1
    if ($fuzzy) { return $fuzzy }

    throw "Không tìm thấy container nào khớp '$Name'. Đang chạy: $($names -join ', ')"
}

$container = Resolve-Container -Name $Service

$dockerArgs = @('logs', '--tail', "$Tail")
if ($Since) { $dockerArgs += @('--since', $Since) }
if ($Follow) { $dockerArgs += '-f' }
if ($Timestamps) { $dockerArgs += '--timestamps' }
$dockerArgs += $container

$headerPattern = '^(trce|dbug|info|warn|fail|crit): '
$timestampPattern = '^(?<ts>\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s(?<rest>.*)$'

$script:block = [System.Collections.Generic.List[string]]::new()
$script:blockTs = $null

function Write-Block {
    if ($script:block.Count -eq 0) { return }

    $lines = $script:block.ToArray()
    $script:block.Clear()
    $raw = $lines -join "`n"

    if ($Sql -and ($raw -notmatch 'Microsoft\.EntityFrameworkCore\.Database\.Command|Executed DbCommand')) { return }
    if ($Filter -and ($raw -notmatch $Filter)) { return }

    if ($Compact -or $Sql) {
        $oneLine = ($raw -replace '\s*\r?\n\s*', ' ').Trim()
        if ($NoColor) {
            Write-Output $oneLine
        }
        else {
            Write-Host $oneLine
        }
        return
    }

    $head = $lines[0]
    $body = @($lines | Select-Object -Skip 1)

    if (-not $NoColor) {
        $color = switch -Regex ($head) {
            '^warn:' { 'Yellow' }
            '^fail:' { 'Red' }
            '^crit:' { 'Magenta' }
            '^dbug:|^trce:' { 'DarkGray' }
            default { 'DarkCyan' }
        }
        if ($script:blockTs) { Write-Host $script:blockTs -ForegroundColor DarkGray -NoNewline; Write-Host ' ' -NoNewline }
        Write-Host $head -ForegroundColor $color
        foreach ($line in $body) { Write-Host "  $($line.TrimStart())" }
        Write-Host ''
    }
    else {
        if ($script:blockTs) { Write-Output "$($script:blockTs) $head" } else { Write-Output $head }
        foreach ($line in $body) { Write-Output "  $($line.TrimStart())" }
        Write-Output ''
    }
}

& docker @dockerArgs 2>&1 | ForEach-Object {
    $line = [string]$_

    if ($Timestamps -and $line -match $timestampPattern) {
        $ts = $Matches.ts
        $line = $Matches.rest
    }
    else {
        $ts = $null
    }

    if ($line -match $headerPattern -or -not ($line -match '^\s')) {
        # Dòng mới: header của logger, hoặc output không theo format logger
        Write-Block
        $script:blockTs = $ts
        $script:block.Add($line)
    }
    elseif ($script:block.Count -gt 0) {
        # Dòng tiếp nối của record hiện tại
        $script:block.Add($line)
    }
    else {
        $script:blockTs = $ts
        $script:block.Add($line)
    }
}

Write-Block

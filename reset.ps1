# 关闭 Cursor
Get-Process Cursor -ErrorAction SilentlyContinue | Stop-Process -Force

# 定义路径
$path = "$env:APPDATA\Cursor\User\globalStorage\storage.json"

# 读取并修改
if (Test-Path $path) {
    $json = Get-Content $path -Raw | ConvertFrom-Json
    
    # 生成随机 ID
    $json.'telemetry.machineId' = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
    $json.'telemetry.macMachineId' = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
    $json.'telemetry.devDeviceId' = [Guid]::NewGuid().ToString()
    $json.'telemetry.sqmId' = "{" + [Guid]::NewGuid().ToString().ToUpper() + "}"
    
    # 写入
    $json | ConvertTo-Json -Depth 10 | Set-Content $path
    Write-Host "重置完成！请注册新账号。" -ForegroundColor Green
} else {
    Write-Host "找不到配置文件" -ForegroundColor Red
}
Pause

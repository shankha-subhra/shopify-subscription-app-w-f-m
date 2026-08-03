$processes = Get-WmiObject Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'sub-app' }
if ($processes) {
    foreach ($p in $processes) {
        Stop-Process -Id $p.ProcessId -Force
    }
    Write-Host "Killed stuck node processes."
} else {
    Write-Host "No stuck node processes found."
}

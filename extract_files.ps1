
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = "backups\Backup_GAG_PM_DASH_2026-02-07_19-30-28.zip"
$destinationDir = "backups\restore"

if (!(Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "*scoreboard.js*" -or $entry.FullName -like "*index.html*") {
        # Normalize the name to avoid subfoldering issues if desired, 
        # or just extract with full path mapped to destination
        $targetFile = Join-Path $destinationDir $entry.Name
        Write-Host "Extracting: $($entry.FullName) to $targetFile"
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetFile, $true)
    }
}
$zip.Dispose()
Write-Host "Done!"

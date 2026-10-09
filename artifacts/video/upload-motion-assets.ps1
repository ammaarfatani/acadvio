$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $PSScriptRoot 'motion-upload-manifest.json'
$items = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
foreach ($item in $items) {
    if ($item.uploaded) { continue }
    $curlArgs = @('-s','-o','NUL','-w','%{http_code}')
    foreach ($field in $item.upload.upload_fields.PSObject.Properties) {
        $curlArgs += @('-F', ($field.Name + '=' + $field.Value))
    }
    $curlArgs += @('-F', ('file=@' + $item.path), $item.upload.upload_url)
    $httpStatus = & curl.exe @curlArgs
    if ($LASTEXITCODE -ne 0 -or $httpStatus -ne '204') { throw ('Upload failed for ' + $item.name + ': HTTP ' + $httpStatus) }
    $item.uploaded = $true
    $items | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    Write-Output ('Uploaded: ' + $item.name)
}

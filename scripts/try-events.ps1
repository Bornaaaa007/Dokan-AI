# Quick check of POST /api/events. Run from the project folder while "npm run dev" is running.
# Usage: .\scripts\try-events.ps1 -CustomerId <a customer user id>
param([Parameter(Mandatory = $true)][string]$CustomerId, [string]$Base = "http://localhost:3000")
$products = (Invoke-RestMethod "${Base}/api/products?q=sari").data
$pid1 = $products[0].id
Write-Host "Using product:" $products[0].name
$h = @{ "x-user-id" = $CustomerId }
function Send($body, $headers) {
  try { (Invoke-RestMethod -Method Post "${Base}/api/events" -Headers $headers -ContentType "application/json" -Body $body) | ConvertTo-Json -Compress }
  catch { "HTTP " + $_.Exception.Response.StatusCode.value__ }
}
Write-Host "1 anonymous view (expect recorded true):";        Send (@{ type = "view"; product_id = $pid1 } | ConvertTo-Json) @{}
Write-Host "2 customer add_to_cart (expect recorded true):";  Send (@{ type = "add_to_cart"; product_id = $pid1 } | ConvertTo-Json) $h
Write-Host "3 same again (expect duplicate):";                Send (@{ type = "add_to_cart"; product_id = $pid1 } | ConvertTo-Json) $h
Write-Host "4 purchase (expect HTTP 400):";                   Send (@{ type = "purchase"; product_id = $pid1 } | ConvertTo-Json) $h

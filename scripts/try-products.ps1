# Quick manual check of the product endpoints. Run with the dev server on: npm run dev
# Usage: .\scripts\try-products.ps1 [-SellerId <users.id of a seller>]
param([string]$SellerId)
$base = "http://localhost:3000/api/products"
"1) search: maroon sari"
(Invoke-RestMethod "${base}?q=maroon%20sari").data | Select-Object name, price_now, in_stock | Format-Table
"2) search with filters: female, wedding, max 3000"
(Invoke-RestMethod "${base}?gender=female&occasion=wedding&max_price=3000").meta
"3) bad filter must be a 400"
try { Invoke-RestMethod "${base}?gender=alien" } catch { $_.Exception.Response.StatusCode.value__ }
if ($SellerId) {
  "4) create a product as the seller"
  $body = '{"name":"[DEMO] Test Product","category":"clothing","gender":"female","age_group":"adult","price":1200,"custom_category":"sari","colors":["green"],"variants":[{"size":"free","color":"green","stock":3}]}'
  $p = Invoke-RestMethod -Method Post $base -Headers @{ "x-user-id" = $SellerId } -ContentType "application/json" -Body $body
  $p.data | Select-Object id, name, price_now, status
  "5) hide it again"
  Invoke-RestMethod -Method Patch "$base/$($p.data.id)" -Headers @{ "x-user-id" = $SellerId } -ContentType "application/json" -Body '{"status":"hidden"}' | Select-Object -ExpandProperty data | Select-Object name, status
}

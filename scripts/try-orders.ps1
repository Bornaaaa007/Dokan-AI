# End-to-end check of orders: place, pay, accept, pack, ship, confirm. Run while "npm run dev" is running.
# Usage: .\scripts\try-orders.ps1 -CustomerId <customer id> -SellerId <id of the owner of the product's shop>
param([Parameter(Mandatory = $true)][string]$CustomerId, [Parameter(Mandatory = $true)][string]$SellerId, [string]$Base = "http://localhost:3000")
$c = @{ "x-user-id" = $CustomerId }; $s = @{ "x-user-id" = $SellerId }
function Call($method, $url, $headers, $body) {
  try { Invoke-RestMethod -Method $method $url -Headers $headers -ContentType "application/json" -Body $body }
  catch { Write-Host "  -> HTTP" $_.Exception.Response.StatusCode.value__ $_.ErrorDetails.Message; $null }
}
$mine = (Call Get "${Base}/api/orders?as=seller" $s $null)   # proves the seller id works
$shop = (Call Get "${Base}/api/shops/mine" $s $null).data
$p = (Call Get "${Base}/api/products?shop_id=$($shop.id)&in_stock=true" @{} $null).data | Select-Object -First 1
$v = $p.variants | Where-Object { $_.stock -gt 0 } | Select-Object -First 1
Write-Host "Ordering:" $p.name $v.size $v.color
$body = @{ items = @(@{ product_id = $p.id; size = $v.size; color = $v.color; qty = 1 }); delivery_address = @{ name = "[DEMO] Buyer"; phone = "01711000000"; line1 = "House 1"; city = "Dhaka" } } | ConvertTo-Json -Depth 5
$o = (Call Post "${Base}/api/orders" $c $body).data; $o | Select-Object id, status, payment_status, total | Format-List
$id = $o.id
Write-Host "Pay:";     (Call Post "${Base}/api/orders/$id/pay" $c "{}").data.order | Select-Object payment_status | Format-List
foreach ($to in "accepted", "packed", "shipped") { Write-Host $to; (Call Patch "${Base}/api/orders/$id/status" $s (@{ status = $to } | ConvertTo-Json)).data | Select-Object status | Format-List }
Write-Host "Customer confirms:"; (Call Patch "${Base}/api/orders/$id/status" $c '{"status":"delivered"}').data | Select-Object status, payment_status | Format-List
Write-Host "Seller view:"; (Call Get "${Base}/api/orders/$id" $s $null).data | Select-Object commission_rate, commission_amount, seller_payout | Format-List

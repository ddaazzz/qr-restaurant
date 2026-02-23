$body = @{
  table_id = 90
  guest_name = "John"
  pax = 4
  booking_date = "2026-02-16"
  booking_time = "19:00"
  status = "confirmed"
} | ConvertTo-Json

$resp = Invoke-WebRequest -Uri "http://localhost:10000/api/restaurants/1/bookings" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing

Write-Host "Status: $($resp.StatusCode)"
$result = $resp.Content | ConvertFrom-Json
Write-Host ($result | ConvertTo-Json -Depth 3)

$body = @{
  table_id = 90
  guest_name = "Test Feb 16"
  pax = 2
  booking_date = "2026-02-16"
  booking_time = "20:00"
  status = "confirmed"
} | ConvertTo-Json

$resp = Invoke-WebRequest -Uri "http://localhost:10000/api/restaurants/1/bookings" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing

Write-Host "Status: $($resp.StatusCode)"
$result = $resp.Content | ConvertFrom-Json
Write-Host "Created booking for date: $($result.booking.booking_date)"
Write-Host "Booking ID: $($result.booking.id)"

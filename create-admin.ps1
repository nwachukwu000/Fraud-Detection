# PowerShell script to create admin user via API
# Make sure the backend is running before executing this script

$uri = "http://localhost:51174/api/auths/create-admin"

Write-Host "Attempting to create admin user..." -ForegroundColor Yellow
Write-Host "Endpoint: $uri" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -ErrorAction Stop
    
    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Admin user created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Credentials:" -ForegroundColor Cyan
    Write-Host "  Email: $($response.email)" -ForegroundColor White
    Write-Host "  Password: $($response.password)" -ForegroundColor White
    Write-Host ""
    Write-Host "$($response.note)" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.ErrorDetails.Message
    
    if ($statusCode -eq 404) {
        Write-Host ""
        Write-Host "ERROR: Endpoint not found (404)" -ForegroundColor Red
        Write-Host "The backend may need to be rebuilt or restarted." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Alternative: Restart the backend - the seeder will create the admin user automatically." -ForegroundColor Cyan
    } elseif ($statusCode -eq 400) {
        Write-Host ""
        Write-Host "ERROR: $errorMessage" -ForegroundColor Red
        Write-Host "The admin user may already exist." -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "ERROR: $statusCode - $errorMessage" -ForegroundColor Red
    }
}

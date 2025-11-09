# Integration Examples

This directory contains example code for integrating the Fraud Detection System with banking infrastructure.

## Files

- `FinacleMiddleware.cs` - C# middleware for Finacle integration
- `appsettings.json` - Configuration example

## Quick Start

### 1. Install Dependencies

```bash
dotnet add package Microsoft.Extensions.Http
dotnet add package Microsoft.Extensions.Configuration
dotnet add package Microsoft.Extensions.Logging
```

### 2. Configure Settings

Update `appsettings.json` with your Fraud Detection API credentials:

```json
{
  "FraudDetection": {
    "ApiBaseUrl": "https://your-fraud-api.com",
    "ServiceAccountEmail": "your-service-account@bank.com",
    "ServiceAccountPassword": "your-password"
  }
}
```

### 3. Register Services

```csharp
// In Startup.cs or Program.cs
services.AddHttpClient<FraudDetectionMiddleware>();
services.AddSingleton<FraudDetectionMiddleware>();
services.Configure<FraudDetectionConfig>(
    configuration.GetSection("FraudDetection"));
```

### 4. Use in Finacle Integration

```csharp
public class FinacleTransactionProcessor
{
    private readonly FraudDetectionMiddleware _fraudMiddleware;
    
    public async Task<TransactionResult> ProcessTransaction(
        FinacleTransaction txn)
    {
        // Check fraud before processing
        var fraudCheck = await _fraudMiddleware.CheckTransactionAsync(txn);
        
        if (!fraudCheck.Allowed)
        {
            return TransactionResult.Rejected(
                $"Transaction rejected: {fraudCheck.Reason}");
        }
        
        // Process transaction in Finacle
        // ...
        
        if (fraudCheck.Flagged)
        {
            // Flag transaction for review
            await FlagForReview(txn, fraudCheck.Reason);
        }
        
        return TransactionResult.Success();
    }
}
```

## Testing

### Unit Test Example

```csharp
[Test]
public async Task HighRiskTransaction_ShouldBeBlocked()
{
    // Arrange
    var mockHttpClient = new Mock<HttpClient>();
    var middleware = new FraudDetectionMiddleware(...);
    var highRiskTxn = new FinacleTransaction
    {
        Amount = 10000000,
        Device = "NewDevice"
    };
    
    // Act
    var result = await middleware.CheckTransactionAsync(highRiskTxn);
    
    // Assert
    Assert.That(result.Allowed, Is.False);
    Assert.That(result.Flagged, Is.True);
}
```

## Error Handling

The middleware includes error handling for:
- API timeouts
- Network errors
- Authentication failures
- Invalid responses

Configure `FailOpen` in settings to determine behavior on errors:
- `true`: Allow transactions when API is unavailable
- `false`: Block transactions when API is unavailable

## Security Notes

1. Store credentials securely (use Azure Key Vault, AWS Secrets Manager, etc.)
2. Use HTTPS for all API communications
3. Implement rate limiting
4. Monitor API usage
5. Rotate credentials regularly


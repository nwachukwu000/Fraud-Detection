# Fraud Detection System - Banking Integration Guide

## Overview

This guide explains how to integrate the Fraud Detection System with banking infrastructure, specifically for banks using Finacle core banking system and mobile banking applications.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│   Mobile App    │────────▶│   Finacle Core   │────────▶│  Fraud Detection    │
│  (User Txns)    │         │   Banking System │         │      API            │
└─────────────────┘         └──────────────────┘         └─────────────────────┘
                                      │                            │
                                      │                            │
                                      ▼                            ▼
                            ┌──────────────────┐         ┌─────────────────────┐
                            │  Integration     │         │  Fraud Detection    │
                            │  Middleware      │         │  Dashboard          │
                            └──────────────────┘         └─────────────────────┘
```

## Integration Approaches

### Approach 1: Real-Time API Integration (Recommended)

**Best for:** Real-time fraud detection with immediate response

#### Flow:
1. User initiates transaction via mobile app
2. Mobile app sends transaction to Finacle
3. Finacle processes transaction and sends to Integration Middleware
4. Middleware forwards transaction to Fraud Detection API
5. Fraud Detection API evaluates transaction and returns risk score
6. Middleware receives response and either:
   - Approves transaction (low risk)
   - Flags for review (medium risk)
   - Blocks transaction (high risk)
7. Response sent back to Finacle and mobile app

### Approach 2: Webhook-Based Integration

**Best for:** Asynchronous processing and batch operations

#### Flow:
1. Transaction completed in Finacle
2. Finacle sends webhook notification to Integration Middleware
3. Middleware forwards to Fraud Detection API
4. Fraud Detection API processes and stores result
5. Bank queries fraud status via API when needed

### Approach 3: Batch Processing

**Best for:** Historical analysis and compliance reporting

#### Flow:
1. Finacle exports transaction batch (hourly/daily)
2. Integration Middleware processes batch
3. Sends to Fraud Detection API
4. Results stored for reporting and analysis

## Implementation Steps

### Step 1: API Authentication Setup

#### 1.1 Obtain API Credentials
```bash
# Contact Fraud Detection System administrator to get:
- API Base URL: https://fraud-detection-api.example.com
- Client ID: your-bank-client-id
- Client Secret: your-bank-client-secret
- API Key: your-api-key
```

#### 1.2 Configure Authentication
The Fraud Detection API uses JWT Bearer tokens. Your integration middleware should:

```csharp
// Example: C# Integration Middleware
public class FraudDetectionClient
{
    private readonly HttpClient _httpClient;
    private readonly string _apiBaseUrl;
    private readonly string _clientId;
    private readonly string _clientSecret;
    
    public async Task<string> GetAccessTokenAsync()
    {
        var request = new
        {
            email = "your-bank-service-account@bank.com",
            password = "your-secure-password"
        };
        
        var response = await _httpClient.PostAsJsonAsync(
            $"{_apiBaseUrl}/api/auths/login", 
            request
        );
        
        var result = await response.Content.ReadFromJsonAsync<LoginResponse>();
        return result.Token;
    }
}
```

### Step 2: Transaction Submission

#### 2.1 Transaction Data Format

When submitting a transaction to the Fraud Detection API, include:

```json
{
  "senderAccountNumber": "ACC1234567890",
  "receiverAccountNumber": "ACC9876543210",
  "transactionType": "Transfer",
  "amount": 500000.00,
  "location": "NG-LAGOS",
  "device": "iOS",
  "ipAddress": "192.168.1.100"
}
```

#### 2.2 API Endpoint

```
POST /api/transactions
Authorization: Bearer {access_token}
Content-Type: application/json
```

#### 2.3 Response Format

```json
{
  "id": "guid",
  "senderAccountNumber": "ACC1234567890",
  "receiverAccountNumber": "ACC9876543210",
  "transactionType": "Transfer",
  "amount": 500000.00,
  "isFlagged": true,
  "status": "Completed",
  "riskScore": 85,
  "location": "NG-LAGOS",
  "device": "iOS",
  "ipAddress": "192.168.1.100",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Step 3: Integration Middleware Implementation

#### 3.1 Middleware Responsibilities

1. **Transaction Interception**: Capture transactions from Finacle
2. **Data Transformation**: Convert Finacle format to Fraud Detection API format
3. **API Communication**: Send to Fraud Detection API
4. **Response Handling**: Process risk scores and take action
5. **Error Handling**: Manage failures gracefully
6. **Logging**: Audit all interactions

#### 3.2 Sample Middleware Code (C#)

```csharp
public class FraudDetectionMiddleware
{
    private readonly FraudDetectionClient _fraudClient;
    private readonly ILogger<FraudDetectionMiddleware> _logger;
    
    public async Task<TransactionResponse> ProcessTransactionAsync(
        FinacleTransaction finacleTxn)
    {
        try
        {
            // Transform Finacle transaction to API format
            var apiTransaction = new TransactionRequest
            {
                SenderAccountNumber = finacleTxn.DebitAccount,
                ReceiverAccountNumber = finacleTxn.CreditAccount,
                TransactionType = MapTransactionType(finacleTxn.TransactionCode),
                Amount = finacleTxn.Amount,
                Location = ExtractLocation(finacleTxn),
                Device = ExtractDevice(finacleTxn),
                IpAddress = finacleTxn.ClientIpAddress
            };
            
            // Submit to Fraud Detection API
            var fraudResponse = await _fraudClient.SubmitTransactionAsync(apiTransaction);
            
            // Process risk score
            if (fraudResponse.RiskScore >= 80)
            {
                // High risk - block transaction
                _logger.LogWarning(
                    "High risk transaction blocked: {TransactionId}, Risk: {RiskScore}",
                    fraudResponse.Id, fraudResponse.RiskScore);
                throw new HighRiskTransactionException(
                    "Transaction flagged as high risk");
            }
            else if (fraudResponse.RiskScore >= 50)
            {
                // Medium risk - flag for review
                _logger.LogInformation(
                    "Medium risk transaction flagged: {TransactionId}, Risk: {RiskScore}",
                    fraudResponse.Id, fraudResponse.RiskScore);
                // Continue processing but flag in Finacle
                await FlagTransactionInFinacle(finacleTxn, fraudResponse);
            }
            
            return fraudResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing fraud detection");
            // Fail open or fail closed based on bank policy
            throw;
        }
    }
    
    private string MapTransactionType(string finacleCode)
    {
        return finacleCode switch
        {
            "FT" => "Transfer",
            "CW" => "Withdrawal",
            "CD" => "Deposit",
            "BP" => "Payment",
            _ => "Transfer"
        };
    }
}
```

### Step 4: Finacle Integration Points

#### 4.1 Finacle Transaction Hooks

Finacle provides several integration points:

1. **Pre-Transaction Hook**: Before transaction is committed
2. **Post-Transaction Hook**: After transaction is committed
3. **Event Notifications**: Real-time event notifications

#### 4.2 Finacle API Integration

```java
// Example: Java Finacle Integration
public class FinacleTransactionInterceptor {
    
    @Autowired
    private FraudDetectionService fraudService;
    
    @PreTransaction
    public TransactionResponse interceptTransaction(
            TransactionRequest request) {
        
        // Call Fraud Detection API
        FraudCheckResult result = fraudService.checkTransaction(
            request.getDebitAccount(),
            request.getCreditAccount(),
            request.getAmount(),
            request.getTransactionType()
        );
        
        if (result.getRiskScore() >= 80) {
            throw new TransactionRejectedException(
                "Transaction rejected due to fraud risk");
        }
        
        return proceed();
    }
}
```

### Step 5: Mobile App Integration

#### 5.1 Transaction Flow

```
User → Mobile App → Finacle → Integration Middleware → Fraud Detection API
                                                              ↓
User ← Mobile App ← Finacle ← Integration Middleware ← Response
```

#### 5.2 Mobile App Considerations

1. **User Experience**: Fraud checks should be transparent
2. **Error Messages**: User-friendly messages for blocked transactions
3. **Timeout Handling**: Handle API timeouts gracefully
4. **Offline Mode**: Consider offline transaction queuing

#### 5.3 Sample Mobile App Code (React Native)

```javascript
// Mobile App Transaction Submission
async function submitTransaction(transactionData) {
  try {
    // Submit to bank's API (which integrates with Finacle)
    const response = await fetch('https://bank-api.example.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...transactionData,
        device: DeviceInfo.getDeviceName(),
        ipAddress: await getIpAddress()
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (error.code === 'FRAUD_RISK_HIGH') {
        showError('Transaction cannot be processed due to security concerns. Please contact support.');
      } else {
        showError('Transaction failed. Please try again.');
      }
      return;
    }
    
    const result = await response.json();
    showSuccess('Transaction completed successfully');
  } catch (error) {
    showError('Network error. Please check your connection.');
  }
}
```

### Step 6: Configuration and Deployment

#### 6.1 Environment Configuration

```json
{
  "FraudDetection": {
    "ApiBaseUrl": "https://fraud-detection-api.example.com",
    "ClientId": "your-client-id",
    "ClientSecret": "your-client-secret",
    "TimeoutSeconds": 5,
    "RetryAttempts": 3,
    "RiskThresholds": {
      "High": 80,
      "Medium": 50,
      "Low": 0
    },
    "ActionOnHighRisk": "Block",
    "ActionOnMediumRisk": "Flag",
    "ActionOnLowRisk": "Allow"
  }
}
```

#### 6.2 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Bank Infrastructure                   │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │  Finacle     │───▶│  Integration │                  │
│  │  Core        │    │  Middleware  │                  │
│  └──────────────┘    └──────┬───────┘                  │
│                              │                           │
│                              │ HTTPS/TLS                 │
│                              ▼                           │
└──────────────────────────────┼───────────────────────────┘
                               │
                               │ Internet/VPN
                               │
┌──────────────────────────────┼───────────────────────────┐
│                    Fraud Detection System                │
│                              │                           │
│                              ▼                           │
│                    ┌──────────────────┐                  │
│                    │  Fraud Detection │                  │
│                    │      API         │                  │
│                    └──────────────────┘                  │
└──────────────────────────────────────────────────────────┘
```

### Step 7: Security Considerations

#### 7.1 Network Security

- Use HTTPS/TLS 1.3 for all API communications
- Implement VPN or private network connection
- Use IP whitelisting for API access
- Implement rate limiting

#### 7.2 Authentication & Authorization

- Use OAuth 2.0 or JWT tokens
- Implement token refresh mechanism
- Use service accounts with limited permissions
- Rotate credentials regularly

#### 7.3 Data Privacy

- Encrypt sensitive data in transit and at rest
- Comply with data protection regulations (GDPR, etc.)
- Implement data retention policies
- Anonymize data where possible

#### 7.4 Audit & Compliance

- Log all API interactions
- Maintain audit trail of all transactions
- Implement compliance reporting
- Regular security audits

### Step 8: Testing Strategy

#### 8.1 Unit Testing

Test individual components:
- Transaction transformation
- API client
- Risk score processing
- Error handling

#### 8.2 Integration Testing

Test end-to-end flows:
- Transaction submission
- Risk evaluation
- Response handling
- Error scenarios

#### 8.3 Load Testing

Test system under load:
- Concurrent transactions
- API response times
- System stability
- Resource utilization

#### 8.4 Test Scenarios

```csharp
// Example Test Cases
public class FraudDetectionTests
{
    [Test]
    public async Task HighRiskTransaction_ShouldBeBlocked()
    {
        var transaction = new TransactionRequest
        {
            Amount = 10000000, // Very high amount
            Device = "NewDevice",
            Location = "SuspiciousLocation"
        };
        
        var result = await _fraudService.ProcessTransactionAsync(transaction);
        
        Assert.That(result.RiskScore, Is.GreaterThanOrEqualTo(80));
        Assert.That(result.IsFlagged, Is.True);
    }
    
    [Test]
    public async Task LowRiskTransaction_ShouldBeApproved()
    {
        var transaction = new TransactionRequest
        {
            Amount = 1000,
            Device = "KnownDevice",
            Location = "KnownLocation"
        };
        
        var result = await _fraudService.ProcessTransactionAsync(transaction);
        
        Assert.That(result.RiskScore, Is.LessThan(50));
        Assert.That(result.IsFlagged, Is.False);
    }
}
```

### Step 9: Monitoring and Alerting

#### 9.1 Key Metrics to Monitor

- API response times
- Transaction processing rates
- Error rates
- Risk score distribution
- False positive rates
- System availability

#### 9.2 Alerting Rules

- API downtime
- High error rates
- Unusual risk score patterns
- Performance degradation
- Security incidents

#### 9.3 Dashboard Setup

Monitor:
- Real-time transaction flow
- Risk score trends
- Flagged transactions
- System health
- API performance

### Step 10: Go-Live Checklist

- [ ] API credentials configured
- [ ] Integration middleware deployed
- [ ] Finacle hooks configured
- [ ] Mobile app updated
- [ ] Security review completed
- [ ] Load testing completed
- [ ] Monitoring configured
- [ ] Alerting configured
- [ ] Documentation completed
- [ ] Team training completed
- [ ] Rollback plan prepared
- [ ] Support team briefed

## API Reference

### Authentication

```http
POST /api/auths/login
Content-Type: application/json

{
  "email": "service-account@bank.com",
  "password": "secure-password"
}

Response:
{
  "token": "jwt-token-here",
  "user": {
    "id": "guid",
    "email": "service-account@bank.com",
    "fullName": "Bank Service Account",
    "role": "Analyst"
  }
}
```

### Submit Transaction

```http
POST /api/transactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "senderAccountNumber": "ACC1234567890",
  "receiverAccountNumber": "ACC9876543210",
  "transactionType": "Transfer",
  "amount": 500000.00,
  "location": "NG-LAGOS",
  "device": "iOS",
  "ipAddress": "192.168.1.100"
}
```

### Get Transaction Details

```http
GET /api/transactions/{id}/details
Authorization: Bearer {token}
```

### Get Alerts

```http
GET /api/alerts?page=1&pageSize=20&status=0
Authorization: Bearer {token}
```

### Add Comment to Transaction

```http
POST /api/comments/transaction/{transactionId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Investigator note: Verified with customer",
  "isInternal": true
}
```

## Support and Contact

For integration support:
- Email: integration-support@fraud-detection.com
- Documentation: https://docs.fraud-detection.com
- API Status: https://status.fraud-detection.com

## Appendix

### A. Transaction Type Mapping

| Finacle Code | Transaction Type |
|--------------|------------------|
| FT           | Transfer         |
| CW           | Withdrawal       |
| CD           | Deposit          |
| BP           | Payment          |
| CH           | Cheque           |

### B. Risk Score Interpretation

| Risk Score | Level | Action |
|------------|-------|--------|
| 0-49       | Low   | Allow  |
| 50-79      | Medium| Flag   |
| 80-100     | High  | Block  |

### C. Error Codes

| Code | Description | Action |
|------|-------------|--------|
| FRAUD_RISK_HIGH | High risk detected | Block transaction |
| FRAUD_RISK_MEDIUM | Medium risk detected | Flag for review |
| API_TIMEOUT | API timeout | Retry or fail open |
| API_ERROR | API error | Log and handle |


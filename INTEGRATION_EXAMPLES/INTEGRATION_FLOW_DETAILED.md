# Detailed Integration Flow: Finacle + Mobile App + Fraud Detection

## Overview

This document explains how the three components (Finacle Core Banking, Mobile Banking App, and Fraud Detection System) work together to detect and prevent fraudulent transactions.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BANKING INFRASTRUCTURE                          │
│                                                                         │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐   │
│  │   Mobile     │         │   Bank API   │         │   Finacle    │   │
│  │ Banking App  │◄───────►│   Gateway    │◄───────►│ Core Banking │   │
│  │  (iOS/Android)│         │              │         │   System     │   │
│  └──────────────┘         └──────┬───────┘         └──────┬───────┘   │
│                                   │                        │           │
│                                   │                        │           │
│                                   ▼                        ▼           │
│                          ┌──────────────────────────────────────┐      │
│                          │   Integration Middleware            │      │
│                          │   (Fraud Detection Client)          │      │
│                          └──────────────┬───────────────────────┘      │
│                                         │                              │
└─────────────────────────────────────────┼──────────────────────────────┘
                                          │
                                          │ HTTPS/TLS
                                          │
┌─────────────────────────────────────────┼──────────────────────────────┐
│                    FRAUD DETECTION SYSTEM                              │
│                                         │                              │
│                                         ▼                              │
│                          ┌──────────────────────────┐                 │
│                          │  Fraud Detection API     │                 │
│                          │  - Transaction Analysis  │                 │
│                          │  - Risk Scoring          │                 │
│                          │  - Rule Engine           │                 │
│                          └──────────────────────────┘                 │
│                                         │                              │
│                                         ▼                              │
│                          ┌──────────────────────────┐                 │
│                          │  Fraud Detection         │                 │
│                          │  Dashboard (Web)         │                 │
│                          └──────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Transaction Flow

### Scenario 1: User Initiates Transfer via Mobile App

```
Step 1: User Action
┌─────────────┐
│   Mobile    │ User opens app and initiates transfer:
│    App      │ - Amount: ₦500,000
│             │ - To: Account 9876543210
│             │ - Purpose: Payment
└──────┬──────┘
       │
       │ POST /api/transactions
       │ {
       │   "fromAccount": "1234567890",
       │   "toAccount": "9876543210",
       │   "amount": 500000,
       │   "type": "transfer"
       │ }
       ▼
Step 2: Bank API Gateway
┌─────────────┐
│  Bank API   │ Receives request, adds metadata:
│  Gateway    │ - Device ID: iPhone-12-Pro
│             │ - IP Address: 192.168.1.100
│             │ - Location: NG-LAGOS
│             │ - Timestamp: 2024-01-15T10:30:00Z
└──────┬──────┘
       │
       │ Forwards to Finacle
       ▼
Step 3: Finacle Core Banking
┌─────────────┐
│  Finacle    │ Receives transaction request
│  Core       │ Validates:
│  Banking    │ - Account exists
│             │ - Sufficient balance
│             │ - Account status (active/blocked)
└──────┬──────┘
       │
       │ Pre-Transaction Hook Triggered
       │ (Before committing transaction)
       ▼
Step 4: Integration Middleware
┌─────────────────────────┐
│ Integration Middleware  │ Intercepts transaction
│ (Fraud Detection Client)│ Transforms to API format:
│                         │ {
│                         │   "senderAccountNumber": "1234567890",
│                         │   "receiverAccountNumber": "9876543210",
│                         │   "transactionType": "Transfer",
│                         │   "amount": 500000,
│                         │   "location": "NG-LAGOS",
│                         │   "device": "iOS",
│                         │   "ipAddress": "192.168.1.100"
│                         │ }
└──────┬──────────────────┘
       │
       │ POST /api/transactions
       │ Authorization: Bearer {token}
       ▼
Step 5: Fraud Detection API
┌─────────────────────────┐
│ Fraud Detection API     │ Receives transaction
│                         │ Evaluates against rules:
│                         │ ✓ Amount > 100,000 (Risk +20)
│                         │ ✓ New device? (Risk +30)
│                         │ ✓ Location check (Risk +10)
│                         │ ✓ Time pattern (Risk +5)
│                         │ 
│                         │ Total Risk Score: 65
│                         │ Status: Medium Risk
└──────┬──────────────────┘
       │
       │ Response:
       │ {
       │   "id": "guid",
       │   "riskScore": 65,
       │   "isFlagged": true,
       │   "status": "Completed"
       │ }
       ▼
Step 6: Integration Middleware
┌─────────────────────────┐
│ Integration Middleware  │ Receives response
│                         │ Decision Logic:
│                         │ - Risk Score: 65 (Medium)
│                         │ - Threshold: Medium = 50
│                         │ - Action: FLAG (allow but monitor)
│                         │ 
│                         │ Logs transaction for review
└──────┬──────────────────┘
       │
       │ Returns to Finacle
       ▼
Step 7: Finacle Core Banking
┌─────────────┐
│  Finacle    │ Receives approval from middleware
│  Core       │ Processes transaction:
│  Banking    │ - Debits sender account
│             │ - Credits receiver account
│             │ - Updates balances
│             │ - Creates transaction record
│             │ - Flags transaction for review
└──────┬──────┘
       │
       │ Transaction Result
       ▼
Step 8: Bank API Gateway
┌─────────────┐
│  Bank API   │ Formats response for mobile app
│  Gateway    │ {
│             │   "transactionId": "TXN123456",
│             │   "status": "success",
│             │   "message": "Transaction completed"
│             │ }
└──────┬──────┘
       │
       │ Response to Mobile App
       ▼
Step 9: Mobile App
┌─────────────┐
│   Mobile    │ Receives success response
│    App      │ Shows confirmation:
│             │ "Transaction successful!
│             │  ₦500,000 transferred to
│             │  Account 9876543210"
└─────────────┘
```

## Scenario 2: High-Risk Transaction (Blocked)

```
Step 1-3: Same as above (User → Bank API → Finacle)

Step 4: Integration Middleware
┌─────────────────────────┐
│ Integration Middleware  │ Sends to Fraud Detection API
└──────┬──────────────────┘
       │
       ▼
Step 5: Fraud Detection API
┌─────────────────────────┐
│ Fraud Detection API     │ Evaluates transaction:
│                         │ ✓ Amount: ₦10,000,000 (Risk +40)
│                         │ ✓ New device (Risk +30)
│                         │ ✓ Unusual location (Risk +25)
│                         │ ✓ Outside business hours (Risk +15)
│                         │ 
│                         │ Total Risk Score: 90
│                         │ Status: HIGH RISK - BLOCK
└──────┬──────────────────┘
       │
       │ Response:
       │ {
       │   "riskScore": 90,
       │   "isFlagged": true,
       │   "status": "Blocked"
       │ }
       ▼
Step 6: Integration Middleware
┌─────────────────────────┐
│ Integration Middleware  │ Decision Logic:
│                         │ - Risk Score: 90 (High)
│                         │ - Threshold: High = 80
│                         │ - Action: BLOCK
│                         │ 
│                         │ Returns rejection to Finacle
└──────┬──────────────────┘
       │
       │ Rejection Response
       ▼
Step 7: Finacle Core Banking
┌─────────────┐
│  Finacle    │ Receives rejection
│  Core       │ Does NOT process transaction
│  Banking    │ - Transaction not committed
│             │ - No balance changes
│             │ - Logs rejection reason
└──────┬──────┘
       │
       │ Error Response
       ▼
Step 8: Bank API Gateway
┌─────────────┐
│  Bank API   │ Formats error response
│  Gateway    │ {
│             │   "status": "failed",
│             │   "code": "FRAUD_RISK_HIGH",
│             │   "message": "Transaction cannot be processed"
│             │ }
└──────┬──────┘
       │
       │ Error to Mobile App
       ▼
Step 9: Mobile App
┌─────────────┐
│   Mobile    │ Receives error
│    App      │ Shows user-friendly message:
│             │ "Transaction cannot be processed
│             │  due to security concerns.
│             │  Please contact customer support."
└─────────────┘
```

## Integration Points

### 1. Finacle Pre-Transaction Hook

Finacle allows you to register hooks that execute before a transaction is committed:

```java
// Finacle Hook Implementation
@PreTransaction
public TransactionResponse preTransactionHook(TransactionRequest request) {
    
    // Call Integration Middleware
    FraudCheckResult fraudCheck = integrationMiddleware
        .checkTransaction(request);
    
    if (!fraudCheck.isAllowed()) {
        // Block transaction
        throw new TransactionRejectedException(
            "Transaction rejected: " + fraudCheck.getReason()
        );
    }
    
    if (fraudCheck.isFlagged()) {
        // Flag for review but allow
        request.setReviewFlag(true);
        request.setReviewReason(fraudCheck.getReason());
    }
    
    return proceed();
}
```

### 2. Mobile App Integration

The mobile app doesn't directly call the Fraud Detection API. Instead:

```javascript
// Mobile App Code (React Native / Flutter)
async function transferMoney(fromAccount, toAccount, amount) {
  try {
    // Step 1: User initiates transfer
    const response = await fetch('https://bank-api.example.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromAccount: fromAccount,
        toAccount: toAccount,
        amount: amount,
        type: 'transfer',
        // Bank API automatically adds:
        // - Device info
        // - IP address
        // - Location (from GPS if permitted)
        // - Timestamp
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      // Transaction approved
      showSuccess('Transfer completed successfully');
    } else if (result.code === 'FRAUD_RISK_HIGH') {
      // Transaction blocked
      showError('Transaction cannot be processed. Please contact support.');
    } else {
      // Other error
      showError(result.message || 'Transaction failed');
    }
  } catch (error) {
    showError('Network error. Please try again.');
  }
}
```

### 3. Integration Middleware

The middleware acts as the bridge between Finacle and Fraud Detection:

```csharp
public class FinacleTransactionInterceptor
{
    private readonly FraudDetectionMiddleware _fraudMiddleware;
    
    // This method is called by Finacle before processing transaction
    public async Task<TransactionApproval> PreProcessTransaction(
        FinacleTransaction txn)
    {
        // Transform Finacle transaction to API format
        var apiRequest = new TransactionRequest
        {
            SenderAccountNumber = txn.DebitAccount,
            ReceiverAccountNumber = txn.CreditAccount,
            TransactionType = MapTransactionType(txn.TransactionCode),
            Amount = txn.Amount,
            Location = ExtractLocation(txn),
            Device = ExtractDeviceInfo(txn),
            IpAddress = txn.ClientIpAddress
        };
        
        // Call Fraud Detection API
        var fraudResult = await _fraudMiddleware
            .CheckTransactionAsync(apiRequest);
        
        // Make decision based on risk score
        if (fraudResult.RiskScore >= 80)
        {
            // High risk - block
            return TransactionApproval.Rejected(
                "High fraud risk detected");
        }
        else if (fraudResult.RiskScore >= 50)
        {
            // Medium risk - flag but allow
            txn.SetReviewFlag(true);
            return TransactionApproval.ApprovedWithFlag(
                "Transaction flagged for review");
        }
        else
        {
            // Low risk - approve
            return TransactionApproval.Approved();
        }
    }
}
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (User Device)                     │
│                                                                 │
│  User Input:                                                    │
│  - Amount: ₦500,000                                            │
│  - Recipient: 9876543210                                       │
│  - Purpose: Payment                                            │
│                                                                 │
│  App Adds:                                                      │
│  - Device ID                                                    │
│  - App Version                                                  │
│  - Session Token                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTPS POST
                     │ /api/transactions
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BANK API GATEWAY                               │
│                                                                 │
│  Receives Request                                               │
│  Adds:                                                          │
│  - IP Address (from request headers)                            │
│  - Timestamp                                                    │
│  - User ID (from token)                                         │
│  - Location (if available from GPS)                             │
│                                                                 │
│  Validates:                                                     │
│  - User authentication                                          │
│  - Request format                                               │
│  - Rate limiting                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Internal API Call
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              FINACLE CORE BANKING SYSTEM                        │
│                                                                 │
│  Validates:                                                     │
│  - Account exists                                               │
│  - Sufficient balance                                           │
│  - Account status                                               │
│  - Transaction limits                                           │
│                                                                 │
│  Triggers:                                                      │
│  - Pre-Transaction Hook                                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Hook Call
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│            INTEGRATION MIDDLEWARE                               │
│            (Fraud Detection Client)                             │
│                                                                 │
│  Transforms Data:                                               │
│  Finacle Format → API Format                                    │
│                                                                 │
│  Calls:                                                         │
│  POST /api/transactions                                         │
│  Authorization: Bearer {token}                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTPS/TLS
                     │ External API Call
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRAUD DETECTION API                                │
│                                                                 │
│  Receives Transaction                                           │
│                                                                 │
│  Evaluates:                                                     │
│  1. Rule Engine                                                 │
│     - Amount rules                                              │
│     - Device rules                                              │
│     - Location rules                                            │
│     - Time-based rules                                          │
│                                                                 │
│  2. Risk Scoring                                                │
│     - Calculate risk score (0-100)                              │
│     - Determine risk level                                      │
│                                                                 │
│  3. Decision                                                    │
│     - Low (0-49): Allow                                         │
│     - Medium (50-79): Flag                                      │
│     - High (80-100): Block                                      │
│                                                                 │
│  Returns:                                                       │
│  {                                                              │
│    "id": "guid",                                                │
│    "riskScore": 65,                                             │
│    "isFlagged": true,                                           │
│    "status": "Completed"                                        │
│  }                                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Response
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│            INTEGRATION MIDDLEWARE                               │
│                                                                 │
│  Processes Response:                                            │
│  - Risk Score: 65                                               │
│  - Threshold: Medium = 50                                       │
│  - Decision: FLAG (allow but monitor)                           │
│                                                                 │
│  Returns to Finacle:                                            │
│  - Approved: true                                               │
│  - Flagged: true                                                │
│  - Reason: "Medium risk transaction"                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Approval
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              FINACLE CORE BANKING SYSTEM                        │
│                                                                 │
│  Processes Transaction:                                         │
│  - Debits sender account                                        │
│  - Credits receiver account                                     │
│  - Updates balances                                             │
│  - Creates transaction record                                   │
│  - Sets review flag                                             │
│                                                                 │
│  Returns Success                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Success Response
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BANK API GATEWAY                               │
│                                                                 │
│  Formats Response:                                              │
│  {                                                              │
│    "transactionId": "TXN123456",                                │
│    "status": "success",                                         │
│    "message": "Transaction completed"                           │
│  }                                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTP Response
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE APP                                   │
│                                                                 │
│  Displays:                                                      │
│  "Transaction successful!                                       │
│   ₦500,000 transferred to                                       │
│   Account 9876543210"                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Key Integration Points

### 1. **Mobile App → Bank API**
- User initiates transaction
- App sends transaction details
- Bank API adds metadata (device, IP, location)

### 2. **Bank API → Finacle**
- Validates transaction
- Checks account status and balance
- Triggers pre-transaction hooks

### 3. **Finacle → Integration Middleware**
- Pre-transaction hook intercepts
- Middleware transforms data format
- Calls Fraud Detection API

### 4. **Integration Middleware → Fraud Detection API**
- Sends transaction for analysis
- Receives risk score and decision
- Returns approval/rejection to Finacle

### 5. **Finacle → Bank API → Mobile App**
- Processes transaction (if approved)
- Returns result to mobile app
- User sees confirmation or error

## Benefits of This Architecture

1. **Transparent to Users**: Fraud detection happens behind the scenes
2. **Real-time Protection**: Transactions are checked before processing
3. **Flexible**: Can adjust risk thresholds without app updates
4. **Scalable**: Middleware handles load balancing and retries
5. **Secure**: All communications are encrypted
6. **Auditable**: All transactions are logged for compliance

## Configuration Example

```json
{
  "FraudDetection": {
    "ApiBaseUrl": "https://fraud-api.example.com",
    "TimeoutSeconds": 5,
    "RiskThresholds": {
      "Low": 0,
      "Medium": 50,
      "High": 80
    },
    "Actions": {
      "OnLowRisk": "Allow",
      "OnMediumRisk": "Flag",
      "OnHighRisk": "Block"
    },
    "FailOpen": false
  }
}
```

This architecture ensures seamless integration while maintaining security and user experience.


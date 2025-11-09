# Transaction Simulator

A console application for simulating incoming transactions to the Fraud Detection API. This tool allows you to create transactions with proper authentication and authorization.

## Features

- **Authentication**: Automatically authenticates with the API using configured credentials
- **Single Transaction**: Create individual transactions with custom details
- **Batch Transactions**: Create multiple transactions at once
- **Random Simulation**: Generate random transactions for testing fraud detection rules

## Configuration

Edit `appsettings.json` to configure:

- **ApiBaseUrl**: The base URL of the Fraud Detection API (default: `http://localhost:51174` for HTTP or `https://localhost:51173` for HTTPS)
- **Credentials**: Email and password for authentication (default: `admin@fraudguard.com` / `Admin123!`)

```json
{
  "ApiBaseUrl": "http://localhost:51174",
  "Credentials": {
    "Email": "admin@fraudguard.com",
    "Password": "Admin123!"
  }
}
```

**Note**: If you're using HTTPS, change the URL to `https://localhost:51173`. The application will automatically handle SSL certificate validation for localhost.

## Usage

1. **Build the application**:
   ```bash
   dotnet build
   ```

2. **Run the application**:
   ```bash
   dotnet run
   ```

3. **Select an option from the menu**:
   - **Option 1**: Create a single transaction with custom details
   - **Option 2**: Create multiple transactions in batch
   - **Option 3**: Create random transactions for simulation (useful for testing fraud detection rules)

## Requirements

- .NET 9.0 SDK
- The Fraud Detection API must be running and accessible
- Valid user credentials (Admin or Analyst role required to create transactions)

## Notes

- The application requires Admin or Analyst role to create transactions
- Transactions are created with risk scores calculated by the fraud detection rules
- High-risk transactions will be automatically flagged
- The random simulation mode is useful for testing fraud detection rules and generating test data


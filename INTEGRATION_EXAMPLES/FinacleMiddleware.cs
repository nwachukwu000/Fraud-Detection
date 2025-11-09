using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;

namespace BankIntegration.FraudDetection
{
    /// <summary>
    /// Integration middleware for connecting Finacle with Fraud Detection API
    /// </summary>
    public class FraudDetectionMiddleware
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<FraudDetectionMiddleware> _logger;
        private readonly FraudDetectionConfig _config;
        private string? _accessToken;
        private DateTime _tokenExpiry;

        public FraudDetectionMiddleware(
            HttpClient httpClient,
            ILogger<FraudDetectionMiddleware> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _config = configuration.GetSection("FraudDetection").Get<FraudDetectionConfig>() 
                ?? throw new InvalidOperationException("FraudDetection config not found");
            
            _httpClient.BaseAddress = new Uri(_config.ApiBaseUrl);
            _httpClient.Timeout = TimeSpan.FromSeconds(_config.TimeoutSeconds);
        }

        /// <summary>
        /// Process transaction through fraud detection
        /// </summary>
        public async Task<FraudCheckResult> CheckTransactionAsync(FinacleTransaction finacleTxn)
        {
            try
            {
                // Ensure we have a valid token
                await EnsureAuthenticatedAsync();

                // Transform Finacle transaction to API format
                var apiTransaction = TransformToApiFormat(finacleTxn);

                // Submit to Fraud Detection API
                var response = await SubmitTransactionAsync(apiTransaction);

                // Process result
                return ProcessResponse(response, finacleTxn);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Error calling Fraud Detection API for transaction {TransactionId}", 
                    finacleTxn.TransactionId);
                
                // Fail open or closed based on configuration
                return _config.FailOpen 
                    ? FraudCheckResult.Allow("API error - allowing transaction") 
                    : FraudCheckResult.Block("API error - blocking transaction");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in fraud detection for transaction {TransactionId}", 
                    finacleTxn.TransactionId);
                throw;
            }
        }

        private async Task EnsureAuthenticatedAsync()
        {
            if (_accessToken != null && DateTime.UtcNow < _tokenExpiry)
                return;

            var loginRequest = new
            {
                email = _config.ServiceAccountEmail,
                password = _config.ServiceAccountPassword
            };

            var response = await _httpClient.PostAsJsonAsync("/api/auths/login", loginRequest);
            response.EnsureSuccessStatusCode();

            var loginResult = await response.Content.ReadFromJsonAsync<LoginResponse>();
            _accessToken = loginResult?.Token;
            _tokenExpiry = DateTime.UtcNow.AddHours(1); // Assume 1 hour expiry

            _httpClient.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _accessToken);
        }

        private TransactionRequest TransformToApiFormat(FinacleTransaction finacleTxn)
        {
            return new TransactionRequest
            {
                SenderAccountNumber = finacleTxn.DebitAccount,
                ReceiverAccountNumber = finacleTxn.CreditAccount,
                TransactionType = MapTransactionType(finacleTxn.TransactionCode),
                Amount = finacleTxn.Amount,
                Location = ExtractLocation(finacleTxn),
                Device = ExtractDevice(finacleTxn),
                IpAddress = finacleTxn.ClientIpAddress
            };
        }

        private string MapTransactionType(string finacleCode)
        {
            return finacleCode switch
            {
                "FT" => "Transfer",
                "CW" => "Withdrawal",
                "CD" => "Deposit",
                "BP" => "Payment",
                "CH" => "Payment", // Cheque
                _ => "Transfer"
            };
        }

        private string? ExtractLocation(FinacleTransaction txn)
        {
            // Extract location from Finacle transaction
            // This depends on how location is stored in Finacle
            return txn.BranchCode != null 
                ? $"NG-{txn.BranchCode}" 
                : txn.GeoLocation;
        }

        private string? ExtractDevice(FinacleTransaction txn)
        {
            // Extract device information from Finacle transaction
            // Check channel type and device info
            return txn.ChannelType switch
            {
                "MOBILE" => txn.DeviceInfo ?? "Mobile",
                "INTERNET" => "Web",
                "ATM" => "ATM",
                "BRANCH" => "Branch",
                _ => "Unknown"
            };
        }

        private async Task<TransactionResponse> SubmitTransactionAsync(TransactionRequest request)
        {
            var response = await _httpClient.PostAsJsonAsync("/api/transactions", request);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<TransactionResponse>() 
                ?? throw new InvalidOperationException("Invalid response from API");
        }

        private FraudCheckResult ProcessResponse(TransactionResponse response, FinacleTransaction originalTxn)
        {
            var riskLevel = DetermineRiskLevel(response.RiskScore);
            
            _logger.LogInformation(
                "Transaction {TransactionId} processed: Risk Score {RiskScore}, Level {RiskLevel}",
                response.Id, response.RiskScore, riskLevel);

            return riskLevel switch
            {
                RiskLevel.High => FraudCheckResult.Block(
                    $"High risk transaction detected (Risk Score: {response.RiskScore})"),
                RiskLevel.Medium => FraudCheckResult.Flag(
                    $"Medium risk transaction (Risk Score: {response.RiskScore})"),
                RiskLevel.Low => FraudCheckResult.Allow(
                    $"Low risk transaction (Risk Score: {response.RiskScore})"),
                _ => FraudCheckResult.Allow("Unknown risk level")
            };
        }

        private RiskLevel DetermineRiskLevel(int riskScore)
        {
            if (riskScore >= _config.RiskThresholds.High)
                return RiskLevel.High;
            if (riskScore >= _config.RiskThresholds.Medium)
                return RiskLevel.Medium;
            return RiskLevel.Low;
        }
    }

    // Data Models
    public class FraudDetectionConfig
    {
        public string ApiBaseUrl { get; set; } = string.Empty;
        public string ServiceAccountEmail { get; set; } = string.Empty;
        public string ServiceAccountPassword { get; set; } = string.Empty;
        public int TimeoutSeconds { get; set; } = 5;
        public bool FailOpen { get; set; } = false; // Fail open = allow on error, Fail closed = block on error
        public RiskThresholds RiskThresholds { get; set; } = new();
    }

    public class RiskThresholds
    {
        public int Low { get; set; } = 0;
        public int Medium { get; set; } = 50;
        public int High { get; set; } = 80;
    }

    public class FinacleTransaction
    {
        public string TransactionId { get; set; } = string.Empty;
        public string DebitAccount { get; set; } = string.Empty;
        public string CreditAccount { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string TransactionCode { get; set; } = string.Empty;
        public string? BranchCode { get; set; }
        public string? GeoLocation { get; set; }
        public string? ChannelType { get; set; }
        public string? DeviceInfo { get; set; }
        public string? ClientIpAddress { get; set; }
    }

    public class TransactionRequest
    {
        public string SenderAccountNumber { get; set; } = string.Empty;
        public string ReceiverAccountNumber { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string? Location { get; set; }
        public string? Device { get; set; }
        public string? IpAddress { get; set; }
    }

    public class TransactionResponse
    {
        public Guid Id { get; set; }
        public string SenderAccountNumber { get; set; } = string.Empty;
        public string ReceiverAccountNumber { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public bool IsFlagged { get; set; }
        public int RiskScore { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class LoginResponse
    {
        public string Token { get; set; } = string.Empty;
        public UserInfo User { get; set; } = new();
    }

    public class UserInfo
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public enum RiskLevel
    {
        Low,
        Medium,
        High
    }

    public class FraudCheckResult
    {
        public bool Allowed { get; set; }
        public bool Flagged { get; set; }
        public string Reason { get; set; } = string.Empty;
        public int? RiskScore { get; set; }

        public static FraudCheckResult Allow(string reason) => new()
        {
            Allowed = true,
            Flagged = false,
            Reason = reason
        };

        public static FraudCheckResult Flag(string reason) => new()
        {
            Allowed = true,
            Flagged = true,
            Reason = reason
        };

        public static FraudCheckResult Block(string reason) => new()
        {
            Allowed = false,
            Flagged = true,
            Reason = reason
        };
    }
}


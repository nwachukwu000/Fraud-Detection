using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace TransactionSimulator;

public class ApiClient
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private string? _token;

    public ApiClient(string baseUrl)
    {
        _baseUrl = baseUrl.TrimEnd('/');
        
        // Create HttpClientHandler to handle SSL certificate validation in development
        var handler = new HttpClientHandler();
        
        // For development: allow self-signed certificates (remove in production)
        if (_baseUrl.StartsWith("https://localhost", StringComparison.OrdinalIgnoreCase) ||
            _baseUrl.StartsWith("https://127.0.0.1", StringComparison.OrdinalIgnoreCase))
        {
            handler.ServerCertificateCustomValidationCallback = 
                (message, cert, chain, errors) => true;
        }
        
        _httpClient = new HttpClient(handler);
        _httpClient.BaseAddress = new Uri(_baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public void SetToken(string token)
    {
        _token = token;
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    public async Task<LoginResponse> LoginAsync(string email, string password)
    {
        var request = new LoginRequest(email, password);
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("/api/auths/login", content);
        response.EnsureSuccessStatusCode();

        var responseJson = await response.Content.ReadAsStringAsync();
        var loginResponse = JsonSerializer.Deserialize<LoginResponse>(responseJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (loginResponse == null)
            throw new Exception("Failed to deserialize login response");

        SetToken(loginResponse.Token);
        return loginResponse;
    }

    public async Task<TransactionResponse> CreateTransactionAsync(TransactionRequest request)
    {
        if (string.IsNullOrEmpty(_token))
            throw new UnauthorizedAccessException("Not authenticated. Please login first.");

        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("/api/transactions", content);
        
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException("Authentication failed. Please login again.");
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new Exception($"Failed to create transaction: {response.StatusCode} - {errorContent}");
        }

        var responseJson = await response.Content.ReadAsStringAsync();
        var transaction = JsonSerializer.Deserialize<TransactionResponse>(responseJson, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (transaction == null)
            throw new Exception("Failed to deserialize transaction response");

        return transaction;
    }

    public void Dispose()
    {
        _httpClient?.Dispose();
    }
}


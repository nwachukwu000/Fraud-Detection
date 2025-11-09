namespace TransactionSimulator;

public record LoginRequest(string Email, string Password);

public record LoginResponse(string Token, UserInfo User);

public record UserInfo(Guid Id, string Email, string FullName, string Role);

public record TransactionRequest(
    string SenderAccountNumber,
    string ReceiverAccountNumber,
    string TransactionType,
    decimal Amount,
    string? Location,
    string? Device,
    string? IpAddress
);

public record TransactionResponse(
    Guid Id,
    string SenderAccountNumber,
    string ReceiverAccountNumber,
    string TransactionType,
    bool IsFlagged,
    string Status,
    string? Location,
    string? Device,
    string? IpAddress,
    DateTime CreatedAt,
    decimal Amount,
    int RiskScore
);


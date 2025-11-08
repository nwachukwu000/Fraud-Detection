using FDMA.Domain.Entities;

namespace FDMA.Application.DTOs;

public record TransactionRequest(string SenderAccountNumber, string ReceiverAccountNumber, string TransactionType, decimal Amount, string? Location, string? Device, string? IpAddress);
public record TransactionResponse(Guid Id, string SenderAccountNumber, string ReceiverAccountNumber, string TransactionType, bool IsFlagged, string Status, string? Location, string? Device, string? IpAddress, DateTime CreatedAt, decimal Amount, int RiskScore)
{
    public static TransactionResponse FromEntity(Transaction t) => new(t.Id, t.SenderAccountNumber, t.ReceiverAccountNumber, t.TransactionType, t.IsFlagged, t.Status, t.Location, t.Device, t.IpAddress, t.CreatedAt, t.Amount, t.RiskScore);
}

public record TriggeredRule(string RuleName, string Description);
public record CustomerInfo(string Name, string AccountNumber, DateTime CustomerSince, decimal AvgTransactionValue);
public record TransactionDetailsResponse(
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
    int RiskScore,
    List<TriggeredRule> TriggeredRules,
    CustomerInfo? SenderInfo,
    CustomerInfo? ReceiverInfo
)
{
    public static TransactionDetailsResponse FromEntity(Transaction t, List<TriggeredRule> triggeredRules, CustomerInfo? senderInfo, CustomerInfo? receiverInfo) =>
        new(t.Id, t.SenderAccountNumber, t.ReceiverAccountNumber, t.TransactionType, t.IsFlagged, t.Status, t.Location, t.Device, t.IpAddress, t.CreatedAt, t.Amount, t.RiskScore, triggeredRules, senderInfo, receiverInfo);
}
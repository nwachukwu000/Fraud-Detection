using FDMA.Domain.Entities;

namespace FDMA.Application.DTOs;

public record TransactionRequest(string SenderAccountNumber, string ReceiverAccountNumber, string TransactionType, decimal Amount, string? Location, string? Device);
public record TransactionResponse(Guid Id, string SenderAccountNumber, string ReceiverAccountNumber, string TransactionType, bool IsFlagged, string Status, string? Location, string? Device, DateTime CreatedAt, decimal Amount, int RiskScore)
{
    public static TransactionResponse FromEntity(Transaction t) => new(t.Id, t.SenderAccountNumber, t.ReceiverAccountNumber, t.TransactionType, t.IsFlagged, t.Status, t.Location, t.Device, t.CreatedAt, t.Amount, t.RiskScore);
}
namespace FDMA.Domain.Entities;

public class Transaction
{
    public Guid Id { get; set; }
    public string SenderAccountNumber { get; set; } = default!;
    public string ReceiverAccountNumber { get; set; } = default!;
    public string TransactionType { get; set; } = default!; // e.g., Transfer, Card, CashIn
    public bool IsFlagged { get; set; }
    public string Status { get; set; } = "Normal"; // Normal, Flagged
    public string? Location { get; set; }
    public string? Device { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public decimal Amount { get; set; }
    public int RiskScore { get; set; }

    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
}
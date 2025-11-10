using FDMA.Domain.Enums;

namespace FDMA.Domain.Entities;

public class Alert
{
    public Guid Id { get; set; }
    public Guid TransactionId { get; set; }
    public Transaction Transaction { get; set; } = default!;

    public string Severity { get; set; } = "";
    public AlertStatus Status { get; set; } = AlertStatus.Pending;
    public string? RuleName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string RuleReason { get; set; } = ""; 
}
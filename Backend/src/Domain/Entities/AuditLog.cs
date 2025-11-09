namespace FDMA.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; }
    public string Action { get; set; } = default!; // e.g., "Transaction Flagged", "Case Created", "Comment Added"
    public string EntityType { get; set; } = default!; // "Transaction", "Case", "Comment", "Rule"
    public Guid EntityId { get; set; }
    public Guid? UserId { get; set; }
    public string UserName { get; set; } = default!;
    public string? Details { get; set; } // JSON or text details
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


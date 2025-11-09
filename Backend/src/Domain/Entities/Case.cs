using FDMA.Domain.Enums;

namespace FDMA.Domain.Entities;

public class Case
{
    public Guid Id { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public Guid TransactionId { get; set; }
    public Transaction? Transaction { get; set; }
    public Guid? InvestigatorId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public CaseStatus Status { get; set; } = CaseStatus.Open;

    public ICollection<Alert> Alerts { get; set; } = new List<Alert>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
}
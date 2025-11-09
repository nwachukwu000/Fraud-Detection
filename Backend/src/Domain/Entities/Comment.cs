namespace FDMA.Domain.Entities;

public class Comment
{
    public Guid Id { get; set; }
    public string Content { get; set; } = default!;
    public Guid? TransactionId { get; set; }
    public Transaction? Transaction { get; set; }
    public Guid? CaseId { get; set; }
    public Case? Case { get; set; }
    public Guid CreatedBy { get; set; } // User ID
    public string CreatedByName { get; set; } = default!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsInternal { get; set; } = false; // Internal notes vs public comments
}


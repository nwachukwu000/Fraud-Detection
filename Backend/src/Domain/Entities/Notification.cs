namespace FDMA.Domain.Entities;

public class Notification
{
    public Guid Id { get; set; }
    public string Text { get; set; } = default!;
    public bool IsSent { get; set; }
    public bool MarkedAsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
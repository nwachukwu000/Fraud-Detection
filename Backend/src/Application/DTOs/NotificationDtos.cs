using FDMA.Domain.Entities;

namespace FDMA.Application.DTOs;

public record NotificationResponse(
    Guid Id,
    string Text,
    bool IsSent,
    bool MarkedAsRead,
    DateTime CreatedAt
)
{
    public static NotificationResponse FromEntity(Notification n) => 
        new(n.Id, n.Text, n.IsSent, n.MarkedAsRead, n.CreatedAt);
}


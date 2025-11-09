using FDMA.Domain.Entities;

namespace FDMA.Application.DTOs;

public record CommentRequest(string Content, bool IsInternal);
public record CommentResponse(Guid Id, string Content, Guid? TransactionId, Guid? CaseId, Guid CreatedBy, string CreatedByName, DateTime CreatedAt, bool IsInternal)
{
    public static CommentResponse FromEntity(Comment c) => new(c.Id, c.Content, c.TransactionId, c.CaseId, c.CreatedBy, c.CreatedByName, c.CreatedAt, c.IsInternal);
}

public record AuditLogResponse(Guid Id, string Action, string EntityType, Guid EntityId, Guid? UserId, string UserName, string? Details, DateTime CreatedAt)
{
    public static AuditLogResponse FromEntity(AuditLog a) => new(a.Id, a.Action, a.EntityType, a.EntityId, a.UserId, a.UserName, a.Details, a.CreatedAt);
}


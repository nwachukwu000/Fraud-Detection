using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FDMA.WebApi.Controllers;

public abstract class BaseController : ControllerBase
{
    protected void CreateAuditLog(AppDbContext db, string action, string entityType, Guid entityId, string? details = null)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var userNameClaim = User.FindFirstValue(ClaimTypes.Name) ?? "Unknown User";
        
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                UserId = userId,
                UserName = userNameClaim,
                Details = details,
                CreatedAt = DateTime.UtcNow
            };
            db.AuditLogs.Add(auditLog);
            // Don't save here - let the calling method save after adding the audit log
        }
    }
}


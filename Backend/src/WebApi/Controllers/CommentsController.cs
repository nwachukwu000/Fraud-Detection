using FDMA.Application.DTOs;
using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CommentsController : ControllerBase
{
    private readonly AppDbContext _db;
    public CommentsController(AppDbContext db) => _db = db;

    [HttpGet("transaction/{transactionId:guid}")]
    public async Task<IActionResult> GetByTransaction(Guid transactionId)
    {
        var comments = await _db.Comments
            .Where(c => c.TransactionId == transactionId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
        return Ok(comments.Select(CommentResponse.FromEntity));
    }

    [HttpGet("case/{caseId:guid}")]
    public async Task<IActionResult> GetByCase(Guid caseId)
    {
        var comments = await _db.Comments
            .Where(c => c.CaseId == caseId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();
        return Ok(comments.Select(CommentResponse.FromEntity));
    }

    [HttpPost("transaction/{transactionId:guid}")]
    public async Task<IActionResult> CreateForTransaction(Guid transactionId, [FromBody] CommentRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? "Unknown User";

        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            Content = req.Content,
            TransactionId = transactionId,
            CreatedBy = userId,
            CreatedByName = userName,
            IsInternal = req.IsInternal,
            CreatedAt = DateTime.UtcNow
        };

        _db.Comments.Add(comment);

        // Create audit log
        var auditLog = new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "Comment Added",
            EntityType = "Transaction",
            EntityId = transactionId,
            UserId = userId,
            UserName = userName,
            Details = $"Comment: {req.Content.Substring(0, Math.Min(100, req.Content.Length))}",
            CreatedAt = DateTime.UtcNow
        };
        _db.AuditLogs.Add(auditLog);

        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetByTransaction), new { transactionId }, CommentResponse.FromEntity(comment));
    }

    [HttpPost("case/{caseId:guid}")]
    public async Task<IActionResult> CreateForCase(Guid caseId, [FromBody] CommentRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? "Unknown User";

        var comment = new Comment
        {
            Id = Guid.NewGuid(),
            Content = req.Content,
            CaseId = caseId,
            CreatedBy = userId,
            CreatedByName = userName,
            IsInternal = req.IsInternal,
            CreatedAt = DateTime.UtcNow
        };

        _db.Comments.Add(comment);

        // Create audit log
        var auditLog = new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "Comment Added",
            EntityType = "Case",
            EntityId = caseId,
            UserId = userId,
            UserName = userName,
            Details = $"Comment: {req.Content.Substring(0, Math.Min(100, req.Content.Length))}",
            CreatedAt = DateTime.UtcNow
        };
        _db.AuditLogs.Add(auditLog);

        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetByCase), new { caseId }, CommentResponse.FromEntity(comment));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var comment = await _db.Comments.FindAsync(id);
        if (comment is null) return NotFound();

        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? Guid.Empty.ToString());
        var userName = User.FindFirstValue(ClaimTypes.Name) ?? "Unknown User";

        // Create audit log
        var auditLog = new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "Comment Deleted",
            EntityType = "Comment",
            EntityId = id,
            UserId = userId,
            UserName = userName,
            Details = $"Deleted comment on {(comment.TransactionId.HasValue ? "Transaction" : "Case")}",
            CreatedAt = DateTime.UtcNow
        };
        _db.AuditLogs.Add(auditLog);

        _db.Comments.Remove(comment);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}


using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace FDMA.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmailRepliesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<EmailRepliesController> _logger;

    public EmailRepliesController(AppDbContext db, ILogger<EmailRepliesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpPost("webhook")]
    [AllowAnonymous] // This endpoint will be called by email service/webhook
    public async Task<IActionResult> HandleEmailReply([FromBody] EmailReplyRequest request)
    {
        try
        {
            // Extract transaction ID from reply-to email or subject
            Guid? transactionId = ExtractTransactionId(request.ReplyTo, request.Subject, request.Body);

            if (!transactionId.HasValue)
            {
                _logger.LogWarning("Could not extract transaction ID from email reply");
                return BadRequest(new { message = "Could not identify transaction from email" });
            }

            // Verify transaction exists
            var transaction = await _db.Transactions.FindAsync(transactionId.Value);
            if (transaction is null)
            {
                _logger.LogWarning($"Transaction {transactionId.Value} not found for email reply");
                return NotFound(new { message = "Transaction not found" });
            }

            // Create notification for admins and analysts
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                Text = $"Email reply received for transaction {transactionId.Value.ToString().Substring(0, 8)}... from {request.FromEmail}: {(request.Body != null ? request.Body.Substring(0, Math.Min(100, request.Body.Length)) : "")}...",
                IsSent = true,
                MarkedAsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _db.Notifications.Add(notification);
            await _db.SaveChangesAsync();

            _logger.LogInformation($"Email reply notification created for transaction {transactionId.Value}");

            return Ok(new { message = "Email reply processed successfully", notificationId = notification.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing email reply");
            return StatusCode(500, new { message = "Error processing email reply" });
        }
    }

    [HttpPost("manual")]
    [Authorize(Roles = "Admin,Analyst")]
    public async Task<IActionResult> CreateManualReplyNotification([FromBody] ManualReplyRequest request)
    {
        try
        {
            var transaction = await _db.Transactions.FindAsync(request.TransactionId);
            if (transaction is null)
                return NotFound(new { message = "Transaction not found" });

            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                Text = $"Email reply received for transaction {request.TransactionId.ToString().Substring(0, 8)}... from {request.FromEmail}: {request.Message}",
                IsSent = true,
                MarkedAsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _db.Notifications.Add(notification);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Notification created successfully", notificationId = notification.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating manual reply notification");
            return StatusCode(500, new { message = "Error creating notification" });
        }
    }

    private Guid? ExtractTransactionId(string? replyTo, string? subject, string? body)
    {
        // Try to extract from reply-to email: username+reply-{transactionId}@gmail.com or reply-{transactionId}@domain.com
        if (!string.IsNullOrWhiteSpace(replyTo))
        {
            // Try Gmail + addressing format: username+reply-{transactionId}@gmail.com
            var gmailMatch = Regex.Match(replyTo, @"\+reply-([a-f0-9]{32})@gmail\.com", RegexOptions.IgnoreCase);
            if (gmailMatch.Success)
            {
                var guidString = gmailMatch.Groups[1].Value;
                // Convert 32 hex chars to GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                if (guidString.Length == 32)
                {
                    var formattedGuid = $"{guidString.Substring(0, 8)}-{guidString.Substring(8, 4)}-{guidString.Substring(12, 4)}-{guidString.Substring(16, 4)}-{guidString.Substring(20, 12)}";
                    if (Guid.TryParse(formattedGuid, out var id))
                    {
                        return id;
                    }
                }
            }
            
            // Try standard format: reply-{transactionId}@domain.com
            var match = Regex.Match(replyTo, @"reply-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", RegexOptions.IgnoreCase);
            if (match.Success && Guid.TryParse(match.Groups[1].Value, out var id2))
            {
                return id2;
            }
        }

        // Try to extract from subject: Fraud Alert: Flagged Transaction - {transactionId}...
        if (!string.IsNullOrWhiteSpace(subject))
        {
            var match = Regex.Match(subject, @"Transaction\s+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", RegexOptions.IgnoreCase);
            if (match.Success && Guid.TryParse(match.Groups[1].Value, out var id))
            {
                return id;
            }
        }

        // Try to extract from body
        if (!string.IsNullOrWhiteSpace(body))
        {
            var match = Regex.Match(body, @"Transaction\s+ID[:\s]+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", RegexOptions.IgnoreCase);
            if (match.Success && Guid.TryParse(match.Groups[1].Value, out var id))
            {
                return id;
            }
        }

        return null;
    }
}

public record EmailReplyRequest(
    string? FromEmail,
    string? ReplyTo,
    string? Subject,
    string? Body,
    DateTime? ReceivedAt
);

public record ManualReplyRequest(
    Guid TransactionId,
    string FromEmail,
    string Message
);


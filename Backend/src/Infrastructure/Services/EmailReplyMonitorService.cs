using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace FDMA.Infrastructure.Services;

public class EmailReplyMonitorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailReplyMonitorService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(5); // Check every 5 minutes

    public EmailReplyMonitorService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<EmailReplyMonitorService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Email Reply Monitor Service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckForEmailReplies(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking for email replies");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }
    }

    private async Task CheckForEmailReplies(CancellationToken cancellationToken)
    {
        var emailSettings = _configuration.GetSection("EmailSettings");
        var enableMonitoring = emailSettings["EnableReplyMonitoring"] == "true";

        if (!enableMonitoring)
        {
            // Service is disabled by default, skip checking
            return;
        }

        var imapHost = emailSettings["ImapHost"] ?? "imap.gmail.com";
        var imapPort = int.Parse(emailSettings["ImapPort"] ?? "993");
        var imapUsername = emailSettings["SmtpUsername"];
        var imapPassword = emailSettings["SmtpPassword"];

        if (string.IsNullOrWhiteSpace(imapUsername) || string.IsNullOrWhiteSpace(imapPassword))
        {
            _logger.LogWarning("IMAP credentials not configured. Skipping email reply check.");
            return;
        }

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Get the last check time from database or use a default
            var lastCheckTime = await GetLastCheckTime(db);
            var newCheckTime = DateTime.UtcNow;

            // Check for replies using IMAP
            var replies = await CheckImapForReplies(imapHost, imapPort, imapUsername, imapPassword, lastCheckTime);

            foreach (var reply in replies)
            {
                await ProcessEmailReply(reply, db, cancellationToken);
            }

            // Update last check time
            await UpdateLastCheckTime(db, newCheckTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in CheckForEmailReplies");
        }
    }

    private Task<List<EmailReply>> CheckImapForReplies(string host, int port, string username, string password, DateTime since)
    {
        var replies = new List<EmailReply>();

        try
        {
            // Use Gmail API or IMAP to check for replies
            // For now, we'll use a simple approach: call our own webhook endpoint
            // In production, you would set up Gmail API push notifications or IMAP polling
            
            // This is a placeholder - in production, implement actual IMAP/Gmail API checking
            // For now, the webhook endpoint can be called manually or via email forwarding service
            
            _logger.LogInformation("Email reply checking is configured but requires Gmail API or IMAP setup.");
            _logger.LogInformation("To enable automatic reply detection, set up Gmail API push notifications or use the webhook endpoint at /api/emailreplies/webhook");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking for email replies");
        }

        return Task.FromResult(replies);
    }

    private async Task ProcessEmailReply(EmailReply reply, AppDbContext db, CancellationToken cancellationToken)
    {
        try
        {
            // Check if notification already exists for this reply
            var existingNotification = await db.Notifications
                .Where(n => n.Text.Contains(reply.TransactionId.ToString().Substring(0, 8)) &&
                           n.Text.Contains(reply.FromEmail) &&
                           n.CreatedAt >= reply.ReceivedAt.AddMinutes(-5))
                .FirstOrDefaultAsync(cancellationToken);

            if (existingNotification != null)
            {
                _logger.LogInformation($"Notification already exists for reply from {reply.FromEmail}");
                return;
            }

            // Verify transaction exists
            var transaction = await db.Transactions.FindAsync(new object[] { reply.TransactionId }, cancellationToken);
            if (transaction == null)
            {
                _logger.LogWarning($"Transaction {reply.TransactionId} not found for email reply");
                return;
            }

            // Create notification
            var notification = new Notification
            {
                Id = Guid.NewGuid(),
                Text = $"Email reply received for transaction {reply.TransactionId.ToString().Substring(0, 8)}... from {reply.FromEmail}: {reply.Body.Substring(0, Math.Min(100, reply.Body.Length))}...",
                IsSent = true,
                MarkedAsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            db.Notifications.Add(notification);
            await db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation($"Created notification for email reply from {reply.FromEmail} for transaction {reply.TransactionId}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error processing email reply: {ex.Message}");
        }
    }

    private Guid? ExtractTransactionId(string? replyTo, string? subject, string? body)
    {
        // Try to extract from reply-to email: reply-{transactionId}@domain.com
        if (!string.IsNullOrWhiteSpace(replyTo))
        {
            var match = Regex.Match(replyTo, @"reply-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", RegexOptions.IgnoreCase);
            if (match.Success && Guid.TryParse(match.Groups[1].Value, out var id))
            {
                return id;
            }
        }

        // Try to extract from subject
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

    private Task<DateTime> GetLastCheckTime(AppDbContext db)
    {
        // Store last check time in a settings table or use a default
        // For now, check last 24 hours
        return Task.FromResult(DateTime.UtcNow.AddHours(-24));
    }

    private Task UpdateLastCheckTime(AppDbContext db, DateTime checkTime)
    {
        // Store last check time in database
        // For now, we'll just log it
        _logger.LogDebug($"Last email check time: {checkTime}");
        return Task.CompletedTask;
    }
}

public class EmailReply
{
    public Guid TransactionId { get; set; }
    public string FromEmail { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime ReceivedAt { get; set; }
}


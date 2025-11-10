using FDMA.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using System.Net;
using System.Net.Mail;

namespace FDMA.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly string _smtpHost;
    private readonly int _smtpPort;
    private readonly string _smtpUsername;
    private readonly string _smtpPassword;
    private readonly string _fromEmail;
    private readonly string _fromName;

    public EmailService(IConfiguration configuration)
    {
        var emailSettings = configuration.GetSection("EmailSettings");
        _smtpHost = emailSettings["SmtpHost"] ?? "smtp.gmail.com";
        _smtpPort = int.Parse(emailSettings["SmtpPort"] ?? "587");
        _smtpUsername = emailSettings["SmtpUsername"] ?? "";
        _smtpPassword = emailSettings["SmtpPassword"] ?? "";
        _fromEmail = emailSettings["FromEmail"] ?? _smtpUsername;
        _fromName = emailSettings["FromName"] ?? "FraudGuard Fraud Detection";
    }

    public async Task SendFlaggedTransactionEmailAsync(string toEmail, string transactionId, decimal amount, int riskScore, string transactionType, DateTime createdAt, string? location = null, List<string>? adminEmails = null)
    {
        var severity = riskScore >= 80 ? "High" : riskScore >= 50 ? "Medium" : "Low";
        var subject = $"Fraud Alert: Flagged Transaction - {transactionId.Substring(0, 8)}...";
        
        // Create reply-to email with transaction ID for tracking
        // Use the actual Gmail address for replies to work properly
        var replyToEmail = _smtpUsername; // Use the actual Gmail account for replies
        // We'll include the transaction ID in the email headers or use a special format
        // For Gmail, we can use the + addressing: username+reply-{transactionId}@gmail.com
        if (_smtpUsername.Contains("@gmail.com"))
        {
            var baseEmail = _smtpUsername.Split('@')[0];
            replyToEmail = $"{baseEmail}+reply-{transactionId.Replace("-", "")}@gmail.com";
        }
        else
        {
            replyToEmail = $"reply-{transactionId}@{_fromEmail.Split('@')[1]}";
        }

        var body = $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }}
        .alert-box {{ background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }}
        .info-row {{ margin: 10px 0; }}
        .label {{ font-weight: bold; color: #6b7280; }}
        .value {{ color: #111827; }}
        .action-box {{ background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Fraud Alert Notification</h1>
        </div>
        <div class=""content"">
            <div class=""alert-box"">
                <h2 style=""margin-top: 0; color: #dc2626;"">Transaction Flagged for Review</h2>
                <p>A transaction has been flagged by our fraud detection system and requires your attention.</p>
            </div>

            <h3>Transaction Details</h3>
            <div class=""info-row"">
                <span class=""label"">Transaction ID:</span>
                <span class=""value"">{transactionId}</span>
            </div>
            <div class=""info-row"">
                <span class=""label"">Amount:</span>
                <span class=""value"">₦{amount:N2}</span>
            </div>
            <div class=""info-row"">
                <span class=""label"">Transaction Type:</span>
                <span class=""value"">{transactionType}</span>
            </div>
            <div class=""info-row"">
                <span class=""label"">Date & Time:</span>
                <span class=""value"">{createdAt:yyyy-MM-dd HH:mm:ss}</span>
            </div>
            {(string.IsNullOrEmpty(location) ? "" : $@"
            <div class=""info-row"">
                <span class=""label"">Location:</span>
                <span class=""value"">{location}</span>
            </div>")}
            <div class=""info-row"">
                <span class=""label"">Risk Score:</span>
                <span class=""value""><strong>{riskScore}</strong> ({severity} Risk)</span>
            </div>

            <div class=""action-box"">
                <h3 style=""margin-top: 0; color: #3b82f6;"">Next Steps</h3>
                <ol>
                    <li>Review the transaction details above</li>
                    <li>Verify the transaction with the account holder if necessary</li>
                    <li>Take appropriate action based on your organization's fraud prevention policies</li>
                    <li>Log into the FraudGuard system to update the case status</li>
                </ol>
            </div>

            <p style=""margin-top: 30px;"">
                <strong>Important:</strong> Please review this transaction promptly. If you believe this is a false positive, 
                you can update the status in the FraudGuard system or reply to this email with any questions or concerns.
            </p>
        </div>
        <div class=""footer"">
            <p>This is an automated message from FraudGuard Fraud Detection System.</p>
            <p>You can reply to this email if you have any questions or concerns about this transaction.</p>
        </div>
    </div>
</body>
</html>";

        // Send email to customer
        await SendEmailAsync(toEmail, subject, body, true, replyToEmail);

        // Send email to admins if provided
        if (adminEmails != null && adminEmails.Any())
        {
            var adminSubject = $"[ADMIN] {subject}";
            var adminBody = body.Replace("Transaction Flagged for Review", "Transaction Flagged - Admin Notification");
            await SendEmailToMultipleAsync(adminEmails, adminSubject, adminBody, true, replyToEmail);
        }
    }

    public async Task<bool> SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true, string? replyTo = null, List<string>? ccEmails = null)
    {
        if (string.IsNullOrWhiteSpace(_smtpUsername) || string.IsNullOrWhiteSpace(_smtpPassword))
        {
            // Email not configured, log and return false
            Console.WriteLine($"Email not configured. Skipping email to {toEmail}");
            return false;
        }

        try
        {
            using var client = new SmtpClient(_smtpHost, _smtpPort)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(_smtpUsername, _smtpPassword),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 30000
            };

            using var message = new MailMessage
            {
                From = new MailAddress(_fromEmail, _fromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = isHtml
            };

            message.To.Add(toEmail);

            if (!string.IsNullOrWhiteSpace(replyTo))
            {
                message.ReplyToList.Add(new MailAddress(replyTo));
            }

            if (ccEmails != null && ccEmails.Any())
            {
                foreach (var ccEmail in ccEmails)
                {
                    if (!string.IsNullOrWhiteSpace(ccEmail))
                    {
                        message.CC.Add(ccEmail);
                    }
                }
            }

            await client.SendMailAsync(message);
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending email to {toEmail}: {ex.Message}");
            return false;
        }
    }

    public async Task<bool> SendEmailToMultipleAsync(List<string> toEmails, string subject, string body, bool isHtml = true, string? replyTo = null)
    {
        if (string.IsNullOrWhiteSpace(_smtpUsername) || string.IsNullOrWhiteSpace(_smtpPassword))
        {
            Console.WriteLine($"Email not configured. Skipping emails to {toEmails.Count} recipients");
            return false;
        }

        try
        {
            using var client = new SmtpClient(_smtpHost, _smtpPort)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(_smtpUsername, _smtpPassword),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 30000
            };

            using var message = new MailMessage
            {
                From = new MailAddress(_fromEmail, _fromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = isHtml
            };

            foreach (var email in toEmails)
            {
                if (!string.IsNullOrWhiteSpace(email))
                {
                    message.To.Add(email);
                }
            }

            if (!string.IsNullOrWhiteSpace(replyTo))
            {
                message.ReplyToList.Add(new MailAddress(replyTo));
            }

            await client.SendMailAsync(message);
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending email to multiple recipients: {ex.Message}");
            return false;
        }
    }
}


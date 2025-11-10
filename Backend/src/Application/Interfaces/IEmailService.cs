namespace FDMA.Application.Interfaces;

public interface IEmailService
{
    Task SendFlaggedTransactionEmailAsync(string toEmail, string transactionId, decimal amount, int riskScore, string transactionType, DateTime createdAt, string? location = null, List<string>? adminEmails = null);
    Task<bool> SendEmailAsync(string toEmail, string subject, string body, bool isHtml = true, string? replyTo = null, List<string>? ccEmails = null);
    Task<bool> SendEmailToMultipleAsync(List<string> toEmails, string subject, string body, bool isHtml = true, string? replyTo = null);
}


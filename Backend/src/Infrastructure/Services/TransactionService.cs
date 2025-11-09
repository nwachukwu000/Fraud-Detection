using FDMA.Application.DTOs;
using FDMA.Application.Interfaces;
using FDMA.Application.Services;
using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FDMA.Infrastructure.Services;

public class TransactionService : ITransactionService
{
    private readonly AppDbContext _db;

    public TransactionService(AppDbContext db) => _db = db;

    private static void ApplyRiskScores(IEnumerable<Transaction> transactions, IReadOnlyCollection<Rule> rules)
    {
        foreach (var tx in transactions)
        {
            var risk = RuleEngine.ComputeRiskScore(tx, rules);
            tx.RiskScore = risk;
            tx.IsFlagged = risk > 0;
            // Update status based on flagged status
            tx.Status = tx.IsFlagged ? "Flagged" : "Normal";
        }
    }

    public async Task<Transaction> CreateAsync(Transaction tx)
    {
        // Compute risk score based on active rules
        var rules = await _db.Rules.Where(r => r.IsEnabled).ToListAsync();
        ApplyRiskScores(new[] { tx }, rules);
        _db.Transactions.Add(tx);
        await _db.SaveChangesAsync();
        if (tx.IsFlagged)
        {
            _db.Alerts.Add(new Alert
            {
                Id = Guid.NewGuid(),
                TransactionId = tx.Id,
                Severity = tx.RiskScore >= 80 ? FDMA.Domain.Enums.AlertSeverity.High : tx.RiskScore >= 50 ? FDMA.Domain.Enums.AlertSeverity.Medium : FDMA.Domain.Enums.AlertSeverity.Low,
                Status = FDMA.Domain.Enums.AlertStatus.Pending,
                RuleName = "RuleEngine:AutoFlag",
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }
        return tx;
    }

    public async Task FlagAsync(Guid id, bool isFlagged)
    {
        var t = await _db.Transactions.FindAsync(id);
        if (t is null) return;
        t.IsFlagged = isFlagged;
        t.Status = isFlagged ? "Flagged" : "Normal";
        await _db.SaveChangesAsync();
    }

    public async Task<Transaction?> GetByIdAsync(Guid id)
    {
        var tx = await _db.Transactions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (tx is null) return null;
        var rules = await _db.Rules.AsNoTracking().Where(r => r.IsEnabled).ToListAsync();
        ApplyRiskScores(new[] { tx }, rules);
        return tx;
    }

    public async Task<TransactionDetailsResponse?> GetDetailsByIdAsync(Guid id)
    {
        var tx = await _db.Transactions
            .Include(t => t.Alerts)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);
        
        if (tx is null) return null;

        // Compute risk score
        var rules = await _db.Rules.AsNoTracking().Where(r => r.IsEnabled).ToListAsync();
        ApplyRiskScores(new[] { tx }, rules);

        // Get triggered rules from alerts and active rules
        var triggeredRules = new List<TriggeredRule>();
        
        // Get alerts for this transaction
        var alerts = await _db.Alerts
            .Where(a => a.TransactionId == id)
            .AsNoTracking()
            .ToListAsync();

        // Get rules that were triggered based on current evaluation
        foreach (var rule in rules)
        {
            var fieldValue = rule.Field.ToLowerInvariant() switch
            {
                "amount" => tx.Amount.ToString(),
                "device" => tx.Device ?? "",
                "location" => tx.Location ?? "",
                "transactiontype" => tx.TransactionType,
                _ => ""
            };
            
            bool match = rule.Condition.ToLowerInvariant() switch
            {
                "greaterthan" when decimal.TryParse(fieldValue, out var v) && decimal.TryParse(rule.Value, out var th) => v > th,
                "equals" => string.Equals(fieldValue, rule.Value, StringComparison.OrdinalIgnoreCase),
                "in" => rule.Value.Split(',').Select(s => s.Trim()).Contains(fieldValue, StringComparer.OrdinalIgnoreCase),
                "notin" => !rule.Value.Split(',').Select(s => s.Trim()).Contains(fieldValue, StringComparer.OrdinalIgnoreCase),
                _ => false
            };

            if (match)
            {
                string description = rule.Field.ToLowerInvariant() switch
                {
                    "amount" when decimal.TryParse(rule.Value, out var threshold) => 
                        $"Transaction amount (₦{tx.Amount:N2}) exceeded the ₦{threshold:N2} threshold.",
                    "device" => $"Transaction was made from a new or suspicious device: {tx.Device}",
                    "location" => $"Transaction originated from a flagged location: {tx.Location}",
                    "transactiontype" => $"Transaction type '{tx.TransactionType}' triggered the rule.",
                    _ => $"{rule.Name} rule was triggered."
                };
                triggeredRules.Add(new TriggeredRule(rule.Name, description));
            }
        }

        // Also check for "New Payee - High Value" type rules
        // Check if this is first transaction to this receiver
        var isFirstTransactionToReceiver = !await _db.Transactions
            .AnyAsync(t => t.SenderAccountNumber == tx.SenderAccountNumber 
                && t.ReceiverAccountNumber == tx.ReceiverAccountNumber 
                && t.Id != tx.Id);
        
        if (isFirstTransactionToReceiver && tx.Amount > 100000)
        {
            triggeredRules.Add(new TriggeredRule(
                "New Payee - High Value",
                $"First-time payment to this recipient exceeded the ₦100,000.00 threshold."
            ));
        }

        // Get customer info (mock data for now - in real app, this would come from a customer service)
        var senderInfo = await GetCustomerInfoAsync(tx.SenderAccountNumber);
        var receiverInfo = await GetCustomerInfoAsync(tx.ReceiverAccountNumber);

        return TransactionDetailsResponse.FromEntity(tx, triggeredRules, senderInfo, receiverInfo);
    }

    private async Task<CustomerInfo?> GetCustomerInfoAsync(string accountNumber)
    {
        // Get first transaction date for this account to determine customer since date
        var firstTransaction = await _db.Transactions
            .Where(t => t.SenderAccountNumber == accountNumber || t.ReceiverAccountNumber == accountNumber)
            .OrderBy(t => t.CreatedAt)
            .AsNoTracking()
            .FirstOrDefaultAsync();

        if (firstTransaction is null) return null;

        // Calculate average transaction value
        var avgValue = await _db.Transactions
            .Where(t => t.SenderAccountNumber == accountNumber || t.ReceiverAccountNumber == accountNumber)
            .AsNoTracking()
            .AverageAsync(t => (double)t.Amount);

        // Generate a mock name based on account number (in real app, this would come from customer service)
        var name = $"Customer {accountNumber.Substring(Math.Max(0, accountNumber.Length - 5))}";

        return new CustomerInfo(
            name,
            accountNumber,
            firstTransaction.CreatedAt,
            (decimal)avgValue
        );
    }

    public async Task<IEnumerable<Transaction>> GetByAccountAsync(string accountNumber)
    {
        var transactions = await _db.Transactions.AsNoTracking()
            .Where(t => t.SenderAccountNumber == accountNumber || t.ReceiverAccountNumber == accountNumber)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
        var rules = await _db.Rules.AsNoTracking().Where(r => r.IsEnabled).ToListAsync();
        ApplyRiskScores(transactions, rules);
        return transactions;
    }

    public async Task<(IEnumerable<Transaction> items, int total)> GetPagedAsync(int page, int pageSize, string? status, string? account, string? type, DateTime? from, DateTime? to, int? minRisk)
    {
        var q = _db.Transactions.AsNoTracking().AsQueryable();
        // Handle status filter - map "normal" and "flagged" to IsFlagged property
        // Note: Status will be updated by ApplyRiskScores after filtering
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (status.Equals("normal", StringComparison.OrdinalIgnoreCase))
            {
                q = q.Where(t => !t.IsFlagged);
            }
            else if (status.Equals("flagged", StringComparison.OrdinalIgnoreCase))
            {
                q = q.Where(t => t.IsFlagged);
            }
            else
            {
                // For backward compatibility, also check status field
                q = q.Where(t => t.Status == status || (status == "Normal" && !t.IsFlagged) || (status == "Flagged" && t.IsFlagged));
            }
        }
        if (!string.IsNullOrWhiteSpace(account)) q = q.Where(t => t.SenderAccountNumber == account || t.ReceiverAccountNumber == account);
        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(t => t.TransactionType == type);
        if (from.HasValue) q = q.Where(t => t.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(t => t.CreatedAt <= to.Value);
        if (minRisk.HasValue) q = q.Where(t => t.RiskScore >= minRisk.Value);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(t => t.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var rules = await _db.Rules.AsNoTracking().Where(r => r.IsEnabled).ToListAsync();
        ApplyRiskScores(items, rules);
        return (items, total);
    }
}
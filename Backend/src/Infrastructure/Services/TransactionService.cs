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
            tx.IsFlagged = risk >= 70;
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
                Severity = tx.RiskScore >= 90 ? FDMA.Domain.Enums.AlertSeverity.High : FDMA.Domain.Enums.AlertSeverity.Medium,
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
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(t => t.Status == status);
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
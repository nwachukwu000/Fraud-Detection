using FDMA.Application.Interfaces;
using FDMA.Application.Services;
using FDMA.Domain.Entities;
using FDMA.Domain.Enums;
using FDMA.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FDMA.Infrastructure.Services;

public class AlertService : IAlertService
{
    private readonly AppDbContext _db;
    public AlertService(AppDbContext db) => _db = db;

    public async Task<Alert?> GetByIdAsync(Guid id) => await _db.Alerts.Include(a => a.Transaction).FirstOrDefaultAsync(a => a.Id == id);

    public async Task<(IEnumerable<Transaction> items, int total)> GetPagedAsync(int page, int pageSize, int? month, AlertSeverity? severity, AlertStatus? status, string? ruleName)
    {
        // Get all transactions and compute risk scores
        var transactions = await _db.Transactions.AsNoTracking().ToListAsync();
        var rules = await _db.Rules.AsNoTracking().Where(r => r.IsEnabled).ToListAsync();
        var cases = await _db.Cases.AsNoTracking().ToListAsync();
        
        // Compute risk scores for all transactions
        foreach (var tx in transactions)
        {
            tx.RiskScore = RuleEngine.ComputeRiskScore(tx, rules);
            tx.IsFlagged = tx.RiskScore >= 70;
        }

        // Filter transactions with risk score > 0
        var q = transactions.Where(t => t.RiskScore > 0).AsQueryable();
        
        if (month.HasValue) q = q.Where(t => t.CreatedAt.Month == month.Value);
        if (severity.HasValue)
        {
            // Map severity to risk score ranges
            q = severity.Value switch
            {
                AlertSeverity.High => q.Where(t => t.RiskScore >= 80),
                AlertSeverity.Medium => q.Where(t => t.RiskScore >= 50 && t.RiskScore < 80),
                AlertSeverity.Low => q.Where(t => t.RiskScore > 0 && t.RiskScore < 50),
                _ => q
            };
        }
        if (status.HasValue)
        {
            // Materialize the query first to work with in-memory collections
            var transactionList = q.ToList();
            var filtered = status.Value switch
            {
                AlertStatus.Pending => transactionList.Where(t => {
                    var caseForTx = cases.FirstOrDefault(c => c.TransactionId == t.Id);
                    return caseForTx == null || caseForTx.Status == CaseStatus.Open;
                }),
                AlertStatus.InReview => transactionList.Where(t => {
                    var caseForTx = cases.FirstOrDefault(c => c.TransactionId == t.Id);
                    return caseForTx != null && caseForTx.Status == CaseStatus.UnderInvestigation;
                }),
                AlertStatus.Resolved => transactionList.Where(t => {
                    var caseForTx = cases.FirstOrDefault(c => c.TransactionId == t.Id);
                    return caseForTx != null && caseForTx.Status == CaseStatus.Closed;
                }),
                _ => transactionList
            };
            q = filtered.AsQueryable();
        }

        var total = q.Count();
        var items = q.OrderByDescending(t => t.CreatedAt).Skip((page-1)*pageSize).Take(pageSize).ToList();
        return (items, total);
    }

    public async Task ResolveAsync(Guid id)
    {
        var a = await _db.Alerts.FindAsync(id);
        if (a is null) return;
        a.Status = AlertStatus.Resolved;
        await _db.SaveChangesAsync();
    }

    public async Task<IEnumerable<(string AccountNumber, int Count)>> GetTopAccountsAsync(int topN = 10)
    {
        var q = await _db.Alerts
            .Include(a => a.Transaction)
            .GroupBy(a => a.Transaction.SenderAccountNumber)
            .Select(g => new { AccountNumber = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(topN)
            .ToListAsync();

        return q.Select(x => (x.AccountNumber, x.Count));
    }
}
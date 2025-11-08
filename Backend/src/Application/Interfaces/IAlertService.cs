using FDMA.Domain.Entities;
using FDMA.Domain.Enums;

namespace FDMA.Application.Interfaces;

public interface IAlertService
{
    Task<(IEnumerable<Transaction> items, int total)> GetPagedAsync(int page, int pageSize, int? month, AlertSeverity? severity, AlertStatus? status, string? ruleName);
    Task<Alert?> GetByIdAsync(Guid id);
    Task ResolveAsync(Guid id);
    Task<IEnumerable<(string AccountNumber, int Count)>> GetTopAccountsAsync(int topN = 10);
}
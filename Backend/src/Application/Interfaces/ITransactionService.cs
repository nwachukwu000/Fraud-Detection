using FDMA.Application.DTOs;
using FDMA.Domain.Entities;

namespace FDMA.Application.Interfaces;

public interface ITransactionService
{
    Task<(IEnumerable<Transaction> items, int total)> GetPagedAsync(
        int page, int pageSize,
        string? status, string? account, string? type,
        DateTime? from, DateTime? to,
        int? minRisk);
    Task<Transaction?> GetByIdAsync(Guid id);
    Task<TransactionDetailsResponse?> GetDetailsByIdAsync(Guid id);
    Task<IEnumerable<Transaction>> GetByAccountAsync(string accountNumber);
    Task<Transaction> CreateAsync(Transaction tx);
    Task FlagAsync(Guid id, bool isFlagged);
}
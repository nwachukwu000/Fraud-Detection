using FDMA.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace FDMA.Infrastructure.Repositories;

public class RepositoryBase<T> : IRepository<T> where T : class
{
    private readonly DbContext _db;
    protected readonly DbSet<T> _set;

    public RepositoryBase(DbContext db)
    {
        _db = db;
        _set = _db.Set<T>();
    }

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default) => await _set.FindAsync(new object[] { id }, ct);
    public async Task<IReadOnlyList<T>> ListAsync(System.Linq.Expressions.Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default)
    {
        IQueryable<T> q = _set;
        if (predicate != null) q = q.Where(predicate);
        return await q.ToListAsync(ct);
    }
    public async Task<T> AddAsync(T entity, CancellationToken ct = default)
    {
        await _set.AddAsync(entity, ct);
        await _db.SaveChangesAsync(ct);
        return entity;
    }
    public async Task UpdateAsync(T entity, CancellationToken ct = default)
    {
        _set.Update(entity);
        await _db.SaveChangesAsync(ct);
    }
    public async Task DeleteAsync(T entity, CancellationToken ct = default)
    {
        _set.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }
}
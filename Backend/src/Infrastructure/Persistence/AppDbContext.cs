using FDMA.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FDMA.Infrastructure.Persistence;

public class AppDbContext : IdentityDbContext<User, IdentityRole<Guid>, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Alert> Alerts => Set<Alert>();
    public DbSet<Case> Cases => Set<Case>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Rule> Rules => Set<Rule>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
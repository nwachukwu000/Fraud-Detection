using FDMA.Domain.Entities;
using FDMA.Infrastructure.Persistence;
using FDMA.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FDMA.UnitTests;

public class TransactionServiceTests
{
    private AppDbContext CreateDb()
    {
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(opts);
        return db;
    }

    [Fact]
    public async Task CreateTransaction_ComputesRiskScoreAndMayCreateAlert()
    {
        var db = CreateDb();
        db.Rules.Add(new Rule { Id = Guid.NewGuid(), Name="High Value", Field="Amount", Condition="GreaterThan", Value="500000" });
        await db.SaveChangesAsync();

        var service = new TransactionService(db);
        var tx = await service.CreateAsync(new Transaction {
            Id = Guid.NewGuid(),
            SenderAccountNumber="A",
            ReceiverAccountNumber="B",
            TransactionType="Transfer",
            Amount=600000
        });

        Assert.True(tx.RiskScore >= 50);
        Assert.True(db.Alerts.Any());
    }
}
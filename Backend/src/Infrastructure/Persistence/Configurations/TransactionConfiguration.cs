using FDMA.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FDMA.Infrastructure.Persistence.Configurations;

public class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.SenderAccountNumber).IsRequired().HasMaxLength(32);
        builder.Property(x => x.ReceiverAccountNumber).IsRequired().HasMaxLength(32);
        builder.Property(x => x.TransactionType).IsRequired().HasMaxLength(32);
        builder.Property(x => x.Amount).HasColumnType("numeric(18,2)");
        builder.HasMany(x => x.Alerts).WithOne(a => a.Transaction).HasForeignKey(a => a.TransactionId);
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.SenderAccountNumber);
        builder.HasIndex(x => x.ReceiverAccountNumber);
    }
}
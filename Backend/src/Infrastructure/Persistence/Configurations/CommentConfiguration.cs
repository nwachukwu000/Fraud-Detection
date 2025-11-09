using FDMA.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FDMA.Infrastructure.Persistence.Configurations;

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Content).IsRequired().HasMaxLength(2000);
        builder.Property(x => x.CreatedByName).IsRequired().HasMaxLength(200);
        builder.HasIndex(x => x.TransactionId);
        builder.HasIndex(x => x.CaseId);
        builder.HasIndex(x => x.CreatedAt);
    }
}


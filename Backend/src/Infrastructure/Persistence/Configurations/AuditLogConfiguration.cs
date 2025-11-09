using FDMA.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FDMA.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Action).IsRequired().HasMaxLength(200);
        builder.Property(x => x.EntityType).IsRequired().HasMaxLength(50);
        builder.Property(x => x.UserName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Details).HasMaxLength(2000);
        builder.HasIndex(x => x.EntityId);
        builder.HasIndex(x => x.EntityType);
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.UserId);
    }
}


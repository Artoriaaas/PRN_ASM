namespace Game.Api.Data.Configurations;

using Game.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class GameAuditLogConfiguration : IEntityTypeConfiguration<GameAuditLog>
{
    public void Configure(EntityTypeBuilder<GameAuditLog> builder)
    {
        builder.ToTable("game_audit_logs");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.ActorFirebaseUid).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Action).HasMaxLength(64).IsRequired();
        builder.Property(x => x.TargetType).HasMaxLength(64).IsRequired();
        builder.Property(x => x.TargetId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.BeforeJson).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.AfterJson).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.Reason).IsRequired();

        builder.HasIndex(x => x.CreatedAt).IsDescending();
    }
}

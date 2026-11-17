namespace User.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using User.Api.Domain.Entities;

public sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");
        builder.HasKey(log => log.Id);

        builder.Property(log => log.Id).HasColumnName("id");
        builder.Property(log => log.ActorId).HasColumnName("actor_id").IsRequired();
        builder.Property(log => log.Action).HasColumnName("action").HasMaxLength(64).IsRequired();
        builder.Property(log => log.TargetType).HasColumnName("target_type").HasMaxLength(64).IsRequired();
        builder.Property(log => log.TargetId).HasColumnName("target_id").IsRequired();
        builder.Property(log => log.Before).HasColumnName("before").HasColumnType("jsonb").IsRequired();
        builder.Property(log => log.After).HasColumnName("after").HasColumnType("jsonb").IsRequired();
        builder.Property(log => log.Reason).HasColumnName("reason").IsRequired();
        builder.Property(log => log.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(log => log.CreatedAt).IsDescending();
        builder.HasIndex(log => new { log.ActorId, log.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(log => new { log.TargetId, log.CreatedAt }).IsDescending(false, true);
    }
}

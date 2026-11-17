namespace Game.Api.Data.Configurations;

using Game.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class TaskDefinitionConfiguration : IEntityTypeConfiguration<TaskDefinition>
{
    public void Configure(EntityTypeBuilder<TaskDefinition> builder)
    {
        builder.ToTable("task_definitions");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Code).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(255).IsRequired();
        builder.Property(x => x.ConditionType).HasMaxLength(32).IsRequired();
        builder.Property(x => x.ProgressSource).HasMaxLength(32).IsRequired();

        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.SortOrder);
    }
}

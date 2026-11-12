namespace Support.Api.Data.Configurations;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Support.Api.Domain.Entities;

public sealed class TutorialConfiguration : IEntityTypeConfiguration<Tutorial>
{
    public void Configure(EntityTypeBuilder<Tutorial> builder)
    {
        builder.ToTable("tutorials");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasColumnName("id");
        builder.Property(t => t.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(t => t.Summary).HasColumnName("summary").HasMaxLength(1000).IsRequired();
        builder.Property(t => t.Content).HasColumnName("content").IsRequired();
        builder.Property(t => t.Category).HasColumnName("category").HasMaxLength(64).IsRequired();
        builder.Property(t => t.Difficulty).HasColumnName("difficulty").HasMaxLength(32).IsRequired();
        builder.Property(t => t.SortOrder).HasColumnName("sort_order");
        builder.Property(t => t.IsPublished).HasColumnName("is_published");
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(t => t.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasIndex(t => t.SortOrder);
        builder.HasIndex(t => t.Category);
        builder.HasIndex(t => t.Difficulty);
    }
}

public sealed class SystemNoticeConfiguration : IEntityTypeConfiguration<SystemNotice>
{
    public void Configure(EntityTypeBuilder<SystemNotice> builder)
    {
        builder.ToTable("system_notices");
        builder.HasKey(n => n.Id);

        builder.Property(n => n.Id).HasColumnName("id");
        builder.Property(n => n.Title).HasColumnName("title").HasMaxLength(255).IsRequired();
        builder.Property(n => n.Content).HasColumnName("content").IsRequired();
        builder.Property(n => n.Category).HasColumnName("category").HasMaxLength(64).IsRequired();
        builder.Property(n => n.IsPinned).HasColumnName("is_pinned");
        builder.Property(n => n.PublishedAt).HasColumnName("published_at").IsRequired();
        builder.Property(n => n.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(n => n.PublishedAt);
        builder.HasIndex(n => n.IsPinned);
    }
}

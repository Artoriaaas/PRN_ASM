namespace Support.Api.Data;

using Microsoft.EntityFrameworkCore;
using Support.Api.Domain.Entities;

public sealed class SupportDbContext(DbContextOptions<SupportDbContext> options) : DbContext(options)
{
    public DbSet<Tutorial> Tutorials => Set<Tutorial>();
    public DbSet<SystemNotice> SystemNotices => Set<SystemNotice>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("support");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SupportDbContext).Assembly);
    }
}

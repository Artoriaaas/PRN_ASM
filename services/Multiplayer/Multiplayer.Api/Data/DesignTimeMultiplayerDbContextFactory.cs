namespace Multiplayer.Api.Data;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

public class DesignTimeMultiplayerDbContextFactory : IDesignTimeDbContextFactory<MultiplayerDbContext>
{
    public MultiplayerDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<MultiplayerDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=multiplayer_db;Username=postgres;Password=postgres")
                      .UseSnakeCaseNamingConvention();
        return new MultiplayerDbContext(optionsBuilder.Options);
    }
}

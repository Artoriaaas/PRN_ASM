namespace Game.Api.Data;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

public class DesignTimeGameDbContextFactory : IDesignTimeDbContextFactory<GameDbContext>
{
    public GameDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<GameDbContext>();
        optionsBuilder
            .UseNpgsql("Host=localhost;Database=game_db;Username=postgres;Password=postgres")
            .UseSnakeCaseNamingConvention();

        return new GameDbContext(optionsBuilder.Options);
    }
}

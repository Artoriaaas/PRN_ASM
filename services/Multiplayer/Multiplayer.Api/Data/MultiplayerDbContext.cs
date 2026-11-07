namespace Multiplayer.Api.Data;

using Microsoft.EntityFrameworkCore;
using Multiplayer.Api.Domain.Entities;
using Sudoku.Messaging;

public class MultiplayerDbContext : DbContext
{
    public MultiplayerDbContext(DbContextOptions<MultiplayerDbContext> options) : base(options) { }

    public DbSet<Match> Matches => Set<Match>();
    public DbSet<MatchPlayer> MatchPlayers => Set<MatchPlayer>();
    public DbSet<MatchMove> MatchMoves => Set<MatchMove>();
    public DbSet<PlayerRating> PlayerRatings => Set<PlayerRating>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MultiplayerDbContext).Assembly);
    }
}

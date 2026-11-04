namespace Game.Api.Data;

using Game.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Sudoku.Messaging;

public class GameDbContext : DbContext
{
    public GameDbContext(DbContextOptions<GameDbContext> options) : base(options) { }

    public DbSet<Level> Levels => Set<Level>();
    public DbSet<Puzzle> Puzzles => Set<Puzzle>();
    public DbSet<GameSession> GameSessions => Set<GameSession>();
    public DbSet<GameMove> GameMoves => Set<GameMove>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GameDbContext).Assembly);
    }
}

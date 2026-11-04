using Game.Api.Data;
using Game.Api.Data.Repositories;
using Game.Api.Domain.Services;
using Game.Api.Grpc;
using Game.Api.Messaging;
using Microsoft.EntityFrameworkCore;
using Sudoku.Auth;
using Sudoku.Observability;

var builder = WebApplication.CreateBuilder(args);

builder.AddSudokuObservability("game-service");

builder.Services.AddDbContext<GameDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Default");
    options.UseNpgsql(connectionString)
           .UseSnakeCaseNamingConvention();
});

builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<ILevelRepository, LevelRepository>();
builder.Services.AddScoped<IPuzzleRepository, PuzzleRepository>();
builder.Services.AddScoped<IGameSessionRepository, GameSessionRepository>();

builder.Services.AddScoped<ISoloRulePolicy, ClassicSoloRulePolicy>();
builder.Services.AddScoped<IPuzzleBankService, PuzzleBankService>();
builder.Services.AddScoped<IGamePlayService, GamePlayService>();
builder.Services.AddScoped<ILeaderboardService, LeaderboardService>();

builder.Services.AddHostedService<GameDataSeeder>();
builder.Services.AddHostedService<PuzzleReplenishWorker>();

builder.Services.AddGrpc(options =>
{
    options.Interceptors.Add<DomainExceptionInterceptor>();
});
builder.Services.AddGrpcHealthChecks();
builder.Services.AddFirebaseJwt(builder.Configuration);

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<GameGrpcService>();
app.MapGrpcHealthChecksService();

app.Run();

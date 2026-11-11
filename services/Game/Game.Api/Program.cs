using Game.Api.Data;
using Game.Api.Data.Repositories;
using Game.Api.Domain.Services;
using Game.Api.Grpc;
using Game.Api.Messaging;
using Microsoft.EntityFrameworkCore;
using Sudoku.Auth;
using Sudoku.Messaging;
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

builder.Services.AddSudokuKafkaPublisher();

builder.Services.AddHostedService<GameDataSeeder>();
builder.Services.AddHostedService<PuzzleReplenishWorker>();
builder.Services.AddHostedService<OutboxProcessorWorker>();

builder.Services.AddGrpc(options =>
{
    options.Interceptors.Add<DomainExceptionInterceptor>();
});
builder.Services.AddGrpcHealthChecks();
builder.Services.AddFirebaseJwt(builder.Configuration);
builder.Services.AddCors(o => o.AddPolicy("AllowWeb", p =>
{
    p.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
     .AllowAnyMethod()
     .AllowAnyHeader()
     .WithExposedHeaders("grpc-status", "grpc-message", "grpc-encoding", "grpc-accept-encoding");
}));

var app = builder.Build();
app.UseRouting();
app.UseCors("AllowWeb");
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<GameGrpcService>().EnableGrpcWeb().RequireCors("AllowWeb");
app.MapGrpcHealthChecksService();
app.Run();

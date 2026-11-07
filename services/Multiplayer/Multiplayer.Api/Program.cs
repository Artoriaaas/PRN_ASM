using System;
using Microsoft.EntityFrameworkCore;
using Multiplayer.Api.Data;
using Multiplayer.Api.Data.Repositories;
using Multiplayer.Api.Domain.Runtime;
using Multiplayer.Api.Domain.Services;
using Multiplayer.Api.Grpc;
using Multiplayer.Api.Hubs;
using Multiplayer.Api.Messaging;
using StackExchange.Redis;
using Sudoku.Auth;
using Sudoku.Game.V1;
using Sudoku.Messaging;
using Sudoku.Observability;
using Sudoku.User.V1;

var builder = WebApplication.CreateBuilder(args);

builder.AddSudokuObservability("multiplayer-service");

builder.Services.AddDbContext<MultiplayerDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Default");
    options.UseNpgsql(connectionString)
           .UseSnakeCaseNamingConvention();
});

var redisConnectionString = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false";
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var config = ConfigurationOptions.Parse(redisConnectionString);
    config.AbortOnConnectFail = false;
    config.ConnectTimeout = 2000;
    return ConnectionMultiplexer.Connect(config);
});

builder.Services.AddGrpcClient<GameService.GameServiceClient>(options =>
{
    var gameUrl = builder.Configuration["Services:Game"] ?? "http://localhost:5101";
    options.Address = new Uri(gameUrl);
});

builder.Services.AddGrpcClient<UserService.UserServiceClient>(options =>
{
    var userUrl = builder.Configuration["Services:User"] ?? "http://localhost:5102";
    options.Address = new Uri(userUrl);
});

builder.Services.AddSudokuKafkaPublisher();

builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<IMatchRepository, MatchRepository>();
builder.Services.AddScoped<IPlayerRatingRepository, PlayerRatingRepository>();
builder.Services.AddScoped<IMultiplayerQueryService, MultiplayerQueryService>();

builder.Services.AddSingleton<IMatchRuntimeStore, RedisMatchRuntimeStore>();
builder.Services.AddSingleton<IRedisLeaderboardCache, RedisLeaderboardCache>();
builder.Services.AddSingleton<IMatchFinalizerService, MatchFinalizerService>();
builder.Services.AddSingleton<IMatchEngineService, MatchEngineService>();
builder.Services.AddSingleton<IMatchmakingService, MatchmakingService>();

builder.Services.AddHostedService<MultiplayerDataSeeder>();
builder.Services.AddHostedService<MatchLifecycleWorker>();
builder.Services.AddHostedService<OutboxProcessorWorker>();

builder.Services.AddGrpc(options =>
{
    options.Interceptors.Add<DomainExceptionInterceptor>();
});
builder.Services.AddGrpcHealthChecks();
builder.Services.AddSignalR();
builder.Services.AddFirebaseJwt(builder.Configuration);

builder.Services.AddCors(o => o.AddPolicy("AllowWeb", p =>
{
    p.SetIsOriginAllowed(_ => true)
     .AllowAnyMethod()
     .AllowAnyHeader()
     .AllowCredentials()
     .WithExposedHeaders("grpc-status", "grpc-message", "grpc-encoding", "grpc-accept-encoding");
}));

var app = builder.Build();

app.UseRouting();
app.UseCors("AllowWeb");
app.UseGrpcWeb(new GrpcWebOptions { DefaultEnabled = true });

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<MultiplayerGrpcService>().EnableGrpcWeb().RequireCors("AllowWeb");
app.MapGrpcHealthChecksService();
app.MapHub<MatchHub>("/hubs/match").RequireCors("AllowWeb");

app.Run();

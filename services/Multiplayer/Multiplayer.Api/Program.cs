using Multiplayer.Api.Grpc;
using Multiplayer.Api.Hubs;
using Sudoku.Auth;
using Sudoku.Observability;

var builder = WebApplication.CreateBuilder(args);

builder.AddSudokuObservability("multiplayer-service");
builder.Services.AddGrpc();
builder.Services.AddGrpcHealthChecks();
builder.Services.AddSignalR();
builder.Services.AddFirebaseJwt(builder.Configuration);

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<MultiplayerGrpcService>();
app.MapGrpcHealthChecksService();
app.MapHub<MatchHub>("/hubs/match");

app.Run();

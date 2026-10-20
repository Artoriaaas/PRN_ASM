using Game.Api.Grpc;
using Sudoku.Auth;
using Sudoku.Observability;

var builder = WebApplication.CreateBuilder(args);

builder.AddSudokuObservability("game-service");
builder.Services.AddGrpc();
builder.Services.AddGrpcHealthChecks();
builder.Services.AddFirebaseJwt(builder.Configuration);

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<GameGrpcService>();
app.MapGrpcHealthChecksService();

app.Run();

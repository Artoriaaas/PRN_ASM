using Sudoku.Auth;
using Sudoku.Observability;
using Support.Api.Grpc;

var builder = WebApplication.CreateBuilder(args);

builder.AddSudokuObservability("support-service");
builder.Services.AddGrpc();
builder.Services.AddGrpcHealthChecks();
builder.Services.AddFirebaseJwt(builder.Configuration);

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<SupportGrpcService>();
app.MapGrpcHealthChecksService();

app.Run();

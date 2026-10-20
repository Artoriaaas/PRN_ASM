using Sudoku.Auth;
using Sudoku.Observability;
using User.Api.Grpc;

var builder = WebApplication.CreateBuilder(args);

builder.AddSudokuObservability("user-service");
builder.Services.AddGrpc();
builder.Services.AddGrpcHealthChecks();
builder.Services.AddFirebaseJwt(builder.Configuration);

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<UserGrpcService>();
app.MapGrpcHealthChecksService();

app.Run();

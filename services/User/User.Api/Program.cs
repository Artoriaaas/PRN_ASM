using Microsoft.EntityFrameworkCore;
using Sudoku.Auth;
using Sudoku.Observability;
using User.Api.Data;
using User.Api.Data.Repositories;
using User.Api.Domain.Repositories;
using User.Api.Domain.Services;
using User.Api.Grpc;

var builder = WebApplication.CreateBuilder(args);

builder.AddSudokuObservability("user-service");
builder.Services.AddGrpc();
builder.Services.AddGrpcHealthChecks();
builder.Services.AddFirebaseJwt(builder.Configuration);
builder.Services.AddDbContext<UserDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserUnitOfWork, UserUnitOfWork>();
builder.Services.AddScoped<IUserProfileService, UserProfileService>();
builder.Services.AddHostedService<User.Api.Messaging.GameEventsConsumerWorker>();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<UserGrpcService>();
app.MapGrpcHealthChecksService();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<UserDbContext>();
    await db.Database.MigrateAsync();
}

app.Run();

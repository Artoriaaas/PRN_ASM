using Microsoft.EntityFrameworkCore;
using Sudoku.Auth;
using Sudoku.Messaging;
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
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddSudokuKafkaPublisher();
builder.Services.AddHostedService<User.Api.Messaging.GameEventsConsumerWorker>();
builder.Services.AddHostedService<User.Api.Messaging.OutboxProcessorWorker>();

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapGrpcService<UserGrpcService>();
app.MapGrpcHealthChecksService();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<UserDbContext>();
    await db.Database.MigrateAsync();

    // Seed dev-admin account (chỉ khi SeedAdmin=true, mặc định bật)
    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var logFactory = scope.ServiceProvider.GetRequiredService<ILoggerFactory>();
    var seedLogger = logFactory.CreateLogger("AdminSeeder");
    await AdminSeeder.SeedAsync(db, config, seedLogger);
}

app.Run();

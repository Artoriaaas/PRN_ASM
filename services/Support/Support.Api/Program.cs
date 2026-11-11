using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using Sudoku.Auth;
using Sudoku.Game.V1;
using Sudoku.Observability;
using Sudoku.User.V1;
using Support.Api.Data;
using Support.Api.Data.Repositories;
using Support.Api.Domain.Repositories;
using Support.Api.Domain.Services;

var builder = WebApplication.CreateBuilder(args);

builder.AddSudokuObservability("support-service");

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Sudoku Platform - Support & Community REST API",
        Version = "v1",
        Description = "ASP.NET Core REST API phục vụ quản lý bài viết hướng dẫn (Tutorials), thông báo hệ thống (Notices) và cổng thông tin tổng hợp tích hợp gRPC inter-service communication."
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Nhập Firebase JWT Token (hoặc Dev Token) theo định dạng: Bearer {token}"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddDbContext<SupportDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Default");
    options.UseNpgsql(connectionString)
           .UseSnakeCaseNamingConvention();
});

builder.Services.AddScoped<ISupportUnitOfWork, SupportUnitOfWork>();
builder.Services.AddScoped<ITutorialRepository, TutorialRepository>();
builder.Services.AddScoped<INoticeRepository, NoticeRepository>();
builder.Services.AddScoped<ITutorialService, TutorialService>();
builder.Services.AddScoped<INoticeService, NoticeService>();

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

builder.Services.AddHostedService<SupportDataSeeder>();

builder.Services.AddFirebaseJwt(builder.Configuration);

builder.Services.AddCors(o => o.AddPolicy("AllowAll", p =>
{
    p.AllowAnyOrigin()
     .AllowAnyMethod()
     .AllowAnyHeader();
}));

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Support API v1");
    c.RoutePrefix = "swagger";
});

app.UseRouting();
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

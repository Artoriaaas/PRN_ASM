namespace Sudoku.Auth;

using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

public static class AuthExtensions
{
    public static IServiceCollection AddFirebaseJwt(this IServiceCollection services, IConfiguration config)
    {
        var projectId = config["Firebase:ProjectId"] ?? throw new InvalidOperationException("Missing Firebase:ProjectId");
        var authority = $"https://securetoken.google.com/{projectId}";

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.Authority = authority;
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = authority,
                    ValidAudience = projectId
                };
                o.Events = new JwtBearerEvents
                {
                    OnMessageReceived = ctx =>
                    {
                        if (ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                        {
                            ctx.Token = ctx.Request.Query["access_token"];
                        }
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization(o => o.AddPolicy("Admin", p => p.RequireClaim("role", "admin")));

        return services;
    }
}

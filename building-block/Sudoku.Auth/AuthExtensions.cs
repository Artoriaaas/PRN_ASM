namespace Sudoku.Auth;

using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

public static class AuthExtensions
{
    public const string DevSecretKey = "sudoku-platform-insecure-dev-jwt-secret-key-2026-minimum-32-chars!";
    public const string DevIssuer = "sudoku-dev-auth";
    public const string DevAudience = "sudoku-platform";

    public static IServiceCollection AddFirebaseJwt(this IServiceCollection services, IConfiguration config)
    {
        var projectId = config["Firebase:ProjectId"] ?? "YOUR_FIREBASE_PROJECT_ID";
        var isDevPlaceholder = string.IsNullOrWhiteSpace(projectId) || projectId == "YOUR_FIREBASE_PROJECT_ID" || config["Firebase:DevMode"] == "true";
        var authority = $"https://securetoken.google.com/{projectId}";

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                if (!isDevPlaceholder)
                {
                    o.Authority = authority;
                    o.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidIssuer = authority,
                        ValidAudience = projectId
                    };
                }
                else
                {
                    o.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = false,
                        ValidateAudience = false,
                        ValidateLifetime = false,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(DevSecretKey))
                    };
                }

                o.MapInboundClaims = false;
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

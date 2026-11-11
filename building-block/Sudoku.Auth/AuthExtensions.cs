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
                var googleIssuer = authority;
                var devSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(DevSecretKey));

                o.Authority = authority;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuers = [googleIssuer, DevIssuer],
                    ValidAudiences = [projectId, DevAudience],
                    ValidateLifetime = true,
                    IssuerSigningKeyResolverUsingConfiguration = (token, securityToken, kid, parameters, configuration) =>
                    {
                        // Dev tokens use a local HMAC key; Firebase tokens keep the signing keys
                        // supplied by the OpenID Connect configuration manager.
                        if (securityToken is Microsoft.IdentityModel.JsonWebTokens.JsonWebToken jwt &&
                            string.Equals(jwt.Alg, SecurityAlgorithms.HmacSha256, System.StringComparison.Ordinal))
                        {
                            return new[] { devSigningKey };
                        }

                        return configuration.SigningKeys;
                    }
                };
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

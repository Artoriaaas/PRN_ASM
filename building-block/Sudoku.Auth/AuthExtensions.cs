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
        var authority = $"https://securetoken.google.com/{projectId}";

        // Dev token (HS256) CHỈ được chấp nhận khi bật tường minh:
        //   Auth:AllowDevTokens = true   (compose: Auth__AllowDevTokens)
        //   Auth:DevSecret      = secret >= 32 ký tự, trùng VITE_DEV_AUTH_SECRET của FE
        // Không bật ⇒ chỉ Firebase ID token hợp lệ mới qua được (mặc định an toàn cho production).
        var allowDevTokens = bool.TryParse(config["Auth:AllowDevTokens"], out var allowDev) && allowDev;
        var devSecret = config["Auth:DevSecret"];
        if (string.IsNullOrWhiteSpace(devSecret) || devSecret.Length < 32)
        {
            devSecret = DevSecretKey;
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                var googleIssuer = authority;
                var devSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(devSecret));

                o.Authority = authority;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuers = allowDevTokens ? [googleIssuer, DevIssuer] : [googleIssuer],
                    ValidAudiences = allowDevTokens ? [projectId, DevAudience] : [projectId],
                    ValidateLifetime = true,
                    IssuerSigningKeyResolverUsingConfiguration = (token, securityToken, kid, parameters, configuration) =>
                    {
                        // Dev tokens dùng HMAC key local; Firebase tokens dùng signing keys từ
                        // OpenID Connect configuration manager. Khi tắt dev-auth thì HMAC token
                        // chỉ nhận được RSA keys ⇒ luôn fail validation.
                        if (allowDevTokens &&
                            securityToken is Microsoft.IdentityModel.JsonWebTokens.JsonWebToken jwt &&
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

# 🧩 HƯỚNG DẪN LẬP TRÌNH VÀ MỞ RỘNG BUILDING BLOCKS (CROSS-CUTTING CONCERNS)
## Dự án: PRN_ASM — Sudoku Online & Realtime Multiplayer Platform

---

## 1. 📌 Tổng quan về Building Blocks

Thư mục `building-block/` chứa các thư viện dùng chung (**Shared Class Libraries**) của toàn bộ hệ thống `PRN_ASM`. 

### Nguyên tắc kiến trúc cốt lõi:
1. **Cross-Cutting Concerns Only**: Chỉ chứa các hạ tầng dùng chung (Xác thực, Messaging, Giám sát, Logging, Caching). **Tuyệt đối không** chứa logic nghiệp vụ đặc thù (Domain Logic) của bất kỳ service nào.
2. **Zero Circular Dependency**: Các building block không được tham chiếu chéo lẫn nhau hoặc tham chiếu ngược lên `services/`.
3. **High Cohesion & Reusability**: Mỗi thư viện giải quyết trọn vẹn một mảng kỹ thuật và cung cấp các `Extension Methods` theo chuẩn Dependency Injection (`IServiceCollection` hoặc `WebApplicationBuilder`) của ASP.NET Core 8.

```text
PRN_ASM/
└── building-block/
    ├── Sudoku.Auth/           # Firebase JWT & Phân quyền Policy
    ├── Sudoku.Messaging/      # Kafka Event Streaming, Outbox & Inbox Pattern
    └── Sudoku.Observability/  # OpenTelemetry Distributed Tracing & Metrics
```

---

## 2. 🔐 1. Thư viện `Sudoku.Auth`

### 2.1. Trách nhiệm & Cấu trúc hiện tại
* **Nhiệm vụ**: Xác thực Firebase JWT Bearer Token tập trung, kiểm tra tính hợp lệ của Token qua Google Remote JWKS, giải quyết bài toán WebSocket Token của SignalR (`/hubs`), và thiết lập Authorization Policy.
* **Các file hiện có**:
  * [Sudoku.Auth.csproj](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Auth/Sudoku.Auth.csproj): Sử dụng `Microsoft.AspNetCore.Authentication.JwtBearer (8.0.13)`.
  * [AuthExtensions.cs](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Auth/AuthExtensions.cs): Chứa extension method `services.AddFirebaseJwt(config)`.

### 2.2. Cách sử dụng trong các Microservices
1. **Cấu hình trong `appsettings.json`** của service:
   ```json
   {
     "Firebase": {
       "ProjectId": "YOUR_FIREBASE_PROJECT_ID"
     }
   }
   ```
2. **Kích hoạt trong `Program.cs`**:
   ```csharp
   using Sudoku.Auth;

   var builder = WebApplication.CreateBuilder(args);

   // Đăng ký xác thực Firebase
   builder.Services.AddFirebaseJwt(builder.Configuration);

   var app = builder.Build();

   // Đặt đúng thứ tự Middleware
   app.UseAuthentication();
   app.UseAuthorization();
   ```
3. **Bảo vệ API & SignalR Hub**:
   ```csharp
   // 1. Bảo vệ gRPC Service
   [Authorize]
   public class UserGrpcService : UserService.UserServiceBase { ... }

   // 2. Bảo vệ endpoint yêu cầu quyền Admin
   [Authorize(Policy = "Admin")]
   public override Task<CreateNoticeResponse> CreateNotice(...) { ... }

   // 3. Bảo vệ SignalR Hub (Token được tự động trích từ Query param 'access_token')
   [Authorize]
   public class MatchHub : Hub { ... }
   ```
4. **Trích xuất thông tin User đã xác thực**:
   ```csharp
   // Trong gRPC Service:
   var userClaims = context.GetHttpContext().User;
   var userId = userClaims.FindFirst(ClaimTypes.NameIdentifier)?.Value;
   var email = userClaims.FindFirst(ClaimTypes.Email)?.Value;

   // Trong SignalR Hub:
   var userId = Context.UserIdentifier; // hoặc Context.User.FindFirst(...)
   ```

### 2.3. Hướng dẫn mở rộng tính năng mới trong `Sudoku.Auth`

#### Kịch bản A: Thêm Helper trích xuất User Claim nhanh gọn
Tạo file `building-block/Sudoku.Auth/ClaimsPrincipalExtensions.cs`:
```csharp
namespace Sudoku.Auth;

using System.Security.Claims;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserId(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? principal.FindFirst("user_id")?.Value 
            ?? principal.FindFirst("sub")?.Value;
    }

    public static string? GetEmail(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Email)?.Value;
    }

    public static bool IsAdmin(this ClaimsPrincipal principal)
    {
        return principal.IsInRole("admin") || principal.HasClaim("role", "admin");
    }
}
```

#### Kịch bản B: Bổ sung thêm Authorization Policies tùy biến
Sửa `AuthExtensions.cs` để nhận cấu hình thêm nhiều policies (vd: `PremiumUser`, `GameMaster`):
```csharp
services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", p => p.RequireClaim("role", "admin"));
    options.AddPolicy("PremiumUser", p => p.RequireClaim("membership", "premium"));
    options.AddPolicy("Moderator", p => p.RequireClaim("role", "admin", "moderator"));
});
```

---

## 3. 📬 2. Thư viện `Sudoku.Messaging`

### 3.1. Trách nhiệm & Cấu trúc hiện tại
* **Nhiệm vụ**: Cung cấp hợp đồng truyền nhận sự kiện (Event-Driven Messaging) qua Kafka, áp dụng Transactional Outbox Pattern (đảm bảo không mất event khi database commit) và Idempotent Inbox Pattern (ngăn chặn duplicate event).
* **Các file hiện có**:
  * [EventEnvelope.cs](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Messaging/EventEnvelope.cs): Phong bì chuẩn hóa cho mọi message gửi qua Kafka.
  * [IEventPublisher.cs](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Messaging/IEventPublisher.cs): Interface định nghĩa việc publish event.
  * [OutboxMessage.cs](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Messaging/OutboxMessage.cs): Entity bảng Outbox lưu sự kiện vào PostgreSQL trước khi gửi.
  * [InboxMessage.cs](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Messaging/InboxMessage.cs): Entity bảng Inbox kiểm tra trùng lặp sự kiện tại Consumer.

### 3.2. Cách sử dụng hiện tại trong các Microservices
1. **Đăng ký bảng Outbox/Inbox trong EF Core `DbContext`**:
   ```csharp
   // services/Game/Game.Api/Data/GameDbContext.cs
   public class GameDbContext : DbContext
   {
       public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
       public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

       protected override void OnModelCreating(ModelBuilder mb)
       {
           mb.Entity<OutboxMessage>(b =>
           {
               b.ToTable("outbox_messages");
               b.HasKey(x => x.Id);
               // Đánh Partial Index quét nhanh các message chưa gửi
               b.HasIndex(x => x.CreatedAt)
                .HasFilter("processed_at IS NULL");
           });

           mb.Entity<InboxMessage>(b =>
           {
               b.ToTable("inbox_messages");
               b.HasKey(x => new { x.EventId, x.HandlerName });
           });
       }
   }
   ```
2. **Ghi sự kiện vào Outbox cùng Transaction nghiệp vụ**:
   ```csharp
   // Khi ván cờ giải thành công:
   var eventPayload = new GameFinished
   {
       SessionId = session.Id,
       UserId = userId,
       IsWin = true,
       Score = session.Score
   };

   // Ghi vào Outbox cùng transaction với game_db:
   _dbContext.OutboxMessages.Add(new OutboxMessage
   {
       EventId = Guid.NewGuid().ToString(),
       Type = nameof(GameFinished),
       UserId = userId,
       Topic = "sudoku.events",
       Payload = eventPayload.ToByteArray()
   });

   await _dbContext.SaveChangesAsync(ct);
   ```

### 3.3. Hướng dẫn mở rộng tính năng mới trong `Sudoku.Messaging`

Hiện tại `Sudoku.Messaging` mới có Interface và Entity models. Dưới đây là cách setup tính năng hoàn chỉnh:

#### Bước 1: Cài đặt Kafka Producer Implementation
Tạo file `building-block/Sudoku.Messaging/KafkaEventPublisher.cs`:
```csharp
namespace Sudoku.Messaging;

using System;
using System.Threading;
using System.Threading.Tasks;
using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

public class KafkaEventPublisher : IEventPublisher, IDisposable
{
    private readonly IProducer<string, byte[]> _producer;
    private readonly ILogger<KafkaEventPublisher> _logger;

    public KafkaEventPublisher(IConfiguration config, ILogger<KafkaEventPublisher> logger)
    {
        _logger = logger;
        var bootstrapServers = config["Kafka:BootstrapServers"] ?? "localhost:9092";

        var producerConfig = new ProducerConfig
        {
            BootstrapServers = bootstrapServers,
            Acks = Acks.All, // Đảm bảo độ tin cậy cao nhất
            EnableIdempotence = true,
            MessageSendMaxRetries = 3
        };

        _producer = new ProducerBuilder<string, byte[]>(producerConfig).Build();
    }

    public async Task PublishAsync(string topic, EventEnvelope @event, CancellationToken cancellationToken = default)
    {
        try
        {
            var message = new Message<string, byte[]>
            {
                Key = @event.UserId,
                Value = @event.Payload,
                Headers = new Headers
                {
                    { "eventId", System.Text.Encoding.UTF8.GetBytes(@event.EventId) },
                    { "type", System.Text.Encoding.UTF8.GetBytes(@event.Type) }
                }
            };

            await _producer.ProduceAsync(topic, message, cancellationToken);
            _logger.LogInformation("Đã publish event {Type} (Id: {EventId}) vào topic {Topic}", 
                @event.Type, @event.EventId, topic);
        }
        catch (ProduceException<string, byte[]> ex)
        {
            _logger.LogError(ex, "Lỗi publish Kafka event: {Reason}", ex.Error.Reason);
            throw;
        }
    }

    public void Dispose()
    {
        _producer?.Flush(TimeSpan.FromSeconds(5));
        _producer?.Dispose();
    }
}
```

#### Bước 2: Tạo Extension Method đăng ký `AddSudokuMessaging`
Tạo file `building-block/Sudoku.Messaging/MessagingExtensions.cs`:
```csharp
namespace Sudoku.Messaging;

using Microsoft.Extensions.DependencyInjection;

public static class MessagingExtensions
{
    public static IServiceCollection AddSudokuKafkaPublisher(this IServiceCollection services)
    {
        services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
        return services;
    }
}
```

#### Bước 3: Tạo Background Worker quét Outbox (`OutboxProcessorWorker`)
Tạo base class hoặc worker chạy nền trong `Sudoku.Messaging` hoặc trong `services/*/Messaging/`:
```csharp
// Quét bảng outbox_messages mỗi 2 giây:
// 1. SELECT * FROM outbox_messages WHERE processed_at IS NULL ORDER BY created_at ASC LIMIT 50;
// 2. Với mỗi record -> Gọi IEventPublisher.PublishAsync(topic, envelope);
// 3. UPDATE outbox_messages SET processed_at = NOW() WHERE id = record.Id;
```

---

## 4. 📈 3. Thư viện `Sudoku.Observability`

### 4.1. Trách nhiệm & Cấu trúc hiện tại
* **Nhiệm vụ**: Cấu hình chuẩn hóa OpenTelemetry cho Distributed Tracing và Metrics, xuất dữ liệu qua chuẩn OTLP tới Collector (Jaeger, Prometheus, Grafana Tempo).
* **Các file hiện có**:
  * [Sudoku.Observability.csproj](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Observability/Sudoku.Observability.csproj): Tích hợp OTLP Exporter, AspNetCore & GrpcNetClient instrumentation.
  * [ObservabilityExtensions.cs](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Observability/ObservabilityExtensions.cs): Hàm `AddSudokuObservability(serviceName)`.

### 4.2. Cách sử dụng hiện tại
1. **Cấu hình `appsettings.json`**:
   ```json
   {
     "Otel": {
       "Endpoint": "http://localhost:4317" // OTLP gRPC endpoint
     }
   }
   ```
2. **Kích hoạt trong `Program.cs` của service**:
   ```csharp
   using Sudoku.Observability;

   var builder = WebApplication.CreateBuilder(args);

   // Tự động gắn Tracing cho ASP.NET Core & gRPC Client
   builder.AddSudokuObservability("game-service");
   ```

### 4.3. Hướng dẫn mở rộng tính năng mới trong `Sudoku.Observability`

#### Kịch bản A: Thêm Instrumentation cho Entity Framework Core & Redis
Để phát hiện các truy vấn SQL chậm hoặc nghẽn Cache:
1. Thêm package vào [Sudoku.Observability.csproj](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Observability/Sudoku.Observability.csproj):
   ```xml
   <PackageReference Include="OpenTelemetry.Instrumentation.EntityFrameworkCore" Version="1.0.0-beta.12" />
   <PackageReference Include="OpenTelemetry.Instrumentation.StackExchangeRedis" Version="1.0.0-rc9.14" />
   ```
2. Cập nhật `ObservabilityExtensions.cs`:
   ```csharp
   tracing
       .AddAspNetCoreInstrumentation()
       .AddGrpcClientInstrumentation()
       .AddEntityFrameworkCoreInstrumentation(opt => opt.SetDbStatementForText = true)
       .AddRedisInstrumentation();
   ```

#### Kịch bản B: Tạo Custom Meter & Custom Metric đo thời gian giải đố
Tạo file `building-block/Sudoku.Observability/SudokuMetrics.cs`:
```csharp
namespace Sudoku.Observability;

using System.Diagnostics.Metrics;

public static class SudokuMetrics
{
    public const string MeterName = "Sudoku.Platform";
    private static readonly Meter Meter = new(MeterName, "1.0.0");

    // Đo thời gian hoàn thành 1 ván Sudoku
    public static readonly Histogram<double> GameDurationHistogram = 
        Meter.CreateHistogram<double>("sudoku.game.duration_seconds", "s", "Thời gian hoàn thành ván cờ");

    // Đếm số trận ghép thành công trong Multiplayer
    public static readonly Counter<long> MatchCompletedCounter = 
        Meter.CreateCounter<long>("sudoku.multiplayer.matches_completed", "matches", "Tổng số trận đấu hoàn thành");
}
```
Sau đó trong `ObservabilityExtensions.cs`, đăng ký meter:
```csharp
metrics
    .AddAspNetCoreInstrumentation()
    .AddMeter(SudokuMetrics.MeterName);
```

Khi sử dụng tại `GameService`:
```csharp
SudokuMetrics.GameDurationHistogram.Record(timeSpentSeconds, new KeyValuePair<string, object?>("difficulty", "Hard"));
```

---

## 5. 🛠️ Quy trình Tạo một Building Block Mới (Step-by-Step)

Nếu sau này dự án cần thêm một Building Block mới (ví dụ: `Sudoku.Caching` để bọc Redis, hoặc `Sudoku.Common`):

### Bước 1: Khởi tạo Class Library qua CLI
Mở terminal tại thư mục gốc của dự án (`PRN_ASM`):
```powershell
# 1. Tạo project .NET 8 mới trong building-block
dotnet new classlib -n Sudoku.Caching -o building-block/Sudoku.Caching

# 2. Thêm project vào Visual Studio Solution gốc
dotnet sln PRN_ASM.sln add building-block/Sudoku.Caching/Sudoku.Caching.csproj
```

### Bước 2: Cấu hình chuẩn `.csproj`
Mở file `building-block/Sudoku.Caching/Sudoku.Caching.csproj` và đảm bảo cấu hình đồng nhất với các thư viện khác:
```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <!-- Nếu cần dùng IServiceCollection hoặc Middleware của ASP.NET Core -->
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>

  <!-- Các package Nuget chuyên trách -->
  <ItemGroup>
    <PackageReference Include="StackExchange.Redis" Version="2.7.33" />
  </ItemGroup>

</Project>
```

### Bước 3: Viết Extension Method đăng ký DI
Luôn tạo file `<ModuleName>Extensions.cs` cung cấp cú pháp `services.AddSudoku<ModuleName>(...)`:
```csharp
namespace Sudoku.Caching;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

public static class CachingExtensions
{
    public static IServiceCollection AddSudokuRedis(this IServiceCollection services, IConfiguration config)
    {
        var redisConn = config.GetConnectionString("Redis") ?? "localhost:6379";
        services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(redisConn));
        return services;
    }
}
```

### Bước 4: Tham chiếu từ Microservice cần sử dụng
Mở file `.csproj` của service cần dùng (ví dụ: `services/Support/Support.Api/Support.Api.csproj`) và thêm:
```xml
<ItemGroup>
  <ProjectReference Include="..\..\..\building-block\Sudoku.Caching\Sudoku.Caching.csproj" />
</ItemGroup>
```
Sau đó gọi `builder.Services.AddSudokuRedis(builder.Configuration)` trong `Program.cs`.

---

## 6. 📋 Bảng Tóm tắt Checklist Quy chuẩn Code trong `building-block/`

* [ ] Thư viện có giữ tính độc lập không? *(Không tham chiếu sang service khác)*.
* [ ] Đã có file Extension Method (`*Extensions.cs`) để đăng ký Dependency Injection dễ dàng chưa?
* [ ] Các giá trị cấu hình (Connection string, endpoint, secret) có được đọc từ `IConfiguration` thay vì hardcode không?
* [ ] Code đã kích hoạt `<Nullable>enable</Nullable>` và xử lý triệt để null reference check chưa?
* [ ] Project đã được thêm vào solution gốc `PRN_ASM.sln` chưa?

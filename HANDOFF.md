# 📘 SUDOKU PLATFORM — DEVELOPER HANDOFF & CODING GUIDE

Tài liệu này đóng vai trò là kim chỉ nam (Handoff Guide) dành cho các lập trình viên tham gia phát triển dự án **PRN_ASM (Sudoku Online Platform)**. Tài liệu quy định chi tiết cấu trúc thư mục, quy ước code từng loại file, quy trình thêm tính năng mới và cách vận hành dự án.

---

## 1. 🏗️ Tổng quan Kiến trúc Hệ thống

Dự án được xây dựng theo kiến trúc **Event-Driven Microservices** kết hợp **gRPC-first**:

```
+-------------------------------------------------------------+
|                      React Frontend (Vite)                  |
|                 (Firebase Auth + Connect-Web)               |
+------------------------------+------------------------------+
                               | (gRPC-Web / HTTP:8080)
                               v
+-------------------------------------------------------------+
|                     Envoy Gateway (:8080)                   |
|                  (Reverse Proxy & gRPC-Web)                 |
+-------+------------------+-------------------+--------------+
        | (:5101)          | (:5102)           | (:5105/:5115)| (:5104)
        v                  v                   v              v
+---------------+  +---------------+  +---------------+  +---------------+
|   Game.Api    |  |   User.Api    |  | Multiplayer   |  |  Support.Api  |
+-------+-------+  +-------+-------+  +-------+-------+  +-------+-------+
        |                  |                  |                  |
        +------------------+---------+--------+------------------+
                                     |
                       +-------------+-------------+
                       |                           |
                       v                           v
              +-----------------+         +-----------------+
              | PostgreSQL DB   |         |  Apache Kafka   |
              | (Per-service DB)|         |  (Event Bus)    |
              +-----------------+         +-----------------+
```

### Công nghệ sử dụng:
* **Backend**: .NET 8 (C# 12), gRPC, SignalR, Entity Framework Core / Dapper.
* **Frontend**: React 19, TypeScript, Vite, `@connectrpc/connect-web` (gRPC-Web), Firebase Auth, SignalR Client.
* **Message Broker & Cache**: Apache Kafka, Redis.
* **API Gateway**: Envoy Proxy (transcode HTTP/gRPC-Web ➔ HTTP/2 gRPC).
* **Database**: PostgreSQL 16.
* **Observability**: OpenTelemetry + OTLP Exporter.

---

## 2. 📂 Chi tiết Cấu trúc Thư mục & Quy ước File

```text
PRN_ASM/
├── proto/                     # Nguồn chân lý (Single Source of Truth) định nghĩa API & Events
├── gateway/                   # Cấu hình Envoy Proxy
├── building-block/            # Thư viện dùng chung (Cross-cutting Concerns) — Xem chi tiết tại BUILDING_BLOCKS.md
│   ├── Sudoku.Auth/           # Firebase JWT Authentication
│   ├── Sudoku.Messaging/      # Kafka Publisher, Outbox & Inbox Pattern
│   └── Sudoku.Observability/  # OpenTelemetry Tracing & Metrics
├── services/                  # Các Microservices độc lập
│   ├── User/User.Api/         # Quản lý User Profile & Thống kê
│   ├── Game/Game.Api/         # Logic ván cờ Sudoku, Levels, Bảng xếp hạng điểm
│   ├── Multiplayer/Multiplayer.Api/ # Ghép trận, Đấu Realtime (SignalR)
│   └── Support/Support.Api/   # Hướng dẫn luật chơi, ticket hỗ trợ
├── web/                       # Single Page Application (React + Vite)
├── deploy/                    # docker-compose.yml & script khởi tạo Database
└── PRN_ASM.sln                # Visual Studio Solution gốc
```

---

## 3. 🎯 "File nào code cái gì?" — Quy tắc theo từng Layer

Mỗi service trong `services/<ServiceName>/<ServiceName>.Api/` được phân chia thành 4 layer chính:

| Thư mục | Tương đương mô hình cũ | Nhiệm vụ cụ thể | Các file cần đặt vào |
| :--- | :--- | :--- | :--- |
| **`Grpc/`** | **Controllers** | Tiếp nhận gRPC requests, validate tham số, gọi Domain/Service và trả về gRPC Response. | `*GrpcService.cs` (kế thừa từ class sinh ra bởi Proto) |
| **`Hubs/`** *(nếu có)* | **Realtime Controllers**| Xử lý kết nối WebSocket/SignalR hai chiều (chat, phòng đấu realtime). | `*Hub.cs` (kế thừa `Microsoft.AspNetCore.SignalR.Hub`) |
| **`Domain/`** | **Services & Entities** | Chứa logic nghiệp vụ thuần túy, entities, validation rules, interfaces use-case. | `Entities/`, `Services/`, `Exceptions/`, `ValueObjects/` |
| **`Data/`** | **Repositories & DbContext** | Kết nối CSDL, truy vấn SQL, cấu hình Fluent API, Migrations. | `*DbContext.cs`, `Repositories/`, `Configurations/` |
| **`Messaging/`** | **Background Workers / Consumers** | Lắng nghe event từ Kafka hoặc quét Outbox Table để gửi event sang service khác. | `*Consumer.cs`, `*EventHandler.cs` |

---

## 4. 📝 Hướng dẫn & Code mẫu chi tiết

### 4.1. Layer Controller: Viết `Grpc/` (Thay cho Controller REST)
File này kế thừa Base class do Proto compiler tạo ra (nằm trong namespace `Sudoku.<Service>.V1`).

**Ví dụ:** `services/User/User.Api/Grpc/UserGrpcService.cs`
```csharp
namespace User.Api.Grpc;

using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Sudoku.User.V1;
using User.Api.Domain.Services; // Gọi service tầng Domain

[Authorize] // Bảo vệ bằng Firebase JWT nếu cần
public class UserGrpcService : UserService.UserServiceBase
{
    private readonly IUserService _userService;

    public UserGrpcService(IUserService userService)
    {
        _userService = userService;
    }

    public override async Task<GetProfileResponse> GetProfile(GetProfileRequest request, ServerCallContext context)
    {
        // 1. Lấy UserId từ Claims (do đã có [Authorize] từ Firebase JWT)
        var userId = context.GetHttpContext().User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? throw new RpcException(new Status(StatusCode.Unauthenticated, "User is not authenticated"));

        var user = await _userService.GetUserByIdAsync(userId);
        if (user == null)
        {
            throw new RpcException(new Status(StatusCode.NotFound, "User not found"));
        }

        // 2. Map sang protobuf response
        return new GetProfileResponse
        {
            Profile = new UserProfile
            {
                Id = user.Id,
                DisplayName = user.DisplayName,
                Email = user.Email,
                TotalGames = user.TotalGames,
                Wins = user.Wins
            }
        };
    }
}
```

---

### 4.2. Layer Business Logic: Viết `Domain/`
Không phụ thuộc vào gRPC hay HTTP. Chứa interface, entity và logic xử lý chính.

**Ví dụ:** `services/User/User.Api/Domain/Services/UserService.cs`
```csharp
namespace User.Api.Domain.Services;

public interface IUserService
{
    Task<UserEntity?> GetUserByIdAsync(string id);
}

public class UserService : IUserService
{
    private readonly IUserRepository _repo;
    private readonly IEventPublisher _eventPublisher; // Từ building-block/Sudoku.Messaging

    public UserService(IUserRepository repo, IEventPublisher eventPublisher)
    {
        _repo = repo;
        _eventPublisher = eventPublisher;
    }

    public async Task<UserEntity?> GetUserByIdAsync(string id)
    {
        return await _repo.FindByIdAsync(id);
    }
}
```

---

### 4.3. Layer Data Access: Viết `Data/` (Repository & DbContext)
Sử dụng EF Core với PostgreSQL.

**Ví dụ:** `services/User/User.Api/Data/UserDbContext.cs`
```csharp
namespace User.Api.Data;

using Microsoft.EntityFrameworkCore;
using User.Api.Domain.Entities;

public class UserDbContext : DbContext
{
    public UserDbContext(DbContextOptions<UserDbContext> options) : base(options) { }

    public DbSet<UserEntity> Users => Set<UserEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("user"); // Phân chia schema rõ ràng
        modelBuilder.Entity<UserEntity>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Email).IsRequired().HasMaxLength(255);
        });
    }
}
```

---

### 4.4. Event-Driven Messaging: Bắn và Nhận Kafka Events
Khi một hành động xảy ra (ví dụ: chơi xong 1 ván game tại `Game.Api`), publish event qua `IEventPublisher` từ [building-block/Sudoku.Messaging](file:///D:/GitHub/PRN_ASM/building-block/Sudoku.Messaging):

```csharp
// Publish event tại Game.Api
var payload = new GameFinished
{
    SessionId = session.Id,
    UserId = session.UserId,
    IsWin = true,
    Score = 1500
};

await _eventPublisher.PublishAsync(
    topic: "sudoku.events",
    key: session.UserId,
    eventType: "GameFinished",
    payload: payload.ToByteArray()
);
```

Consumer tại `User.Api` bắt event này và cộng dồn số trận thắng vào database mà không cần gọi trực tiếp API của nhau (giảm coupling).

---

### 4.5. Inter-Service Communication: Gọi gRPC Client sang Service khác & Hứng Response
Khi một microservice cần dữ liệu đồng bộ từ service khác (ví dụ: `Multiplayer.Api` hoặc `Game.Api` cần kiểm tra thông tin người chơi từ `User.Api`):

#### Bước 1: Khai báo Protobuf Client trong `.csproj`
Đảm bảo file `.csproj` của service gọi (ví dụ `Multiplayer.Api.csproj`) đã cấu hình thuộc tính `GrpcServices="Client"`:
```xml
<ItemGroup>
  <Protobuf Include="../../../proto/sudoku/user/v1/user.proto" ProtoRoot="../../../proto" GrpcServices="Client" />
</ItemGroup>
```

#### Bước 2: Đăng ký gRPC Client trong `Program.cs`
Sử dụng thư viện `Grpc.Net.ClientFactory` (đã có sẵn trong project):
```csharp
// services/Multiplayer/Multiplayer.Api/Program.cs
builder.Services.AddGrpcClient<Sudoku.User.V1.UserService.UserServiceClient>(options =>
{
    // Đọc URL từ appsettings.json ("Services:User")
    var userUrl = builder.Configuration["Services:User"] ?? "http://localhost:5102";
    options.Address = new Uri(userUrl);
});
```

#### Bước 3: Inject Client vào Service, Thực thi RPC & Hứng Response
Luôn đặt `deadline`, truyền `CancellationToken` và bắt `RpcException` chuẩn:

```csharp
// services/Multiplayer/Multiplayer.Api/Domain/Services/MatchmakerService.cs
namespace Multiplayer.Api.Domain.Services;

using Grpc.Core;
using Sudoku.User.V1;

public interface IMatchmakerService
{
    Task<UserProfile?> GetPlayerProfileAsync(string userId, CancellationToken ct);
}

public class MatchmakerService : IMatchmakerService
{
    private readonly UserService.UserServiceClient _userClient;
    private readonly ILogger<MatchmakerService> _logger;

    public MatchmakerService(
        UserService.UserServiceClient userClient,
        ILogger<MatchmakerService> logger)
    {
        _userClient = userClient;
        _logger = logger;
    }

    public async Task<UserProfile?> GetPlayerProfileAsync(string userId, CancellationToken ct)
    {
        try
        {
            // 1. Gọi RPC đồng bộ sang User.Api kèm Deadline 3s và CancellationToken
            var response = await _userClient.GetProfileAsync(
                new GetProfileRequest(), // Request message
                deadline: DateTime.UtcNow.AddSeconds(3),
                cancellationToken: ct
            );

            // 2. Hứng và sử dụng Response trả về từ service đích
            UserProfile profile = response.Profile;
            _logger.LogInformation("Lấy thông tin người chơi thành công: {Name} ({Wins} wins)", 
                profile.DisplayName, profile.Wins);

            return profile;
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.NotFound)
        {
            _logger.LogWarning("Không tìm thấy profile cho UserId: {UserId}", userId);
            return null;
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.DeadlineExceeded)
        {
            _logger.LogError("Gọi User.Api bị timeout quá 3s!");
            throw;
        }
        catch (RpcException ex)
        {
            _logger.LogError(ex, "Gọi gRPC sang User.Api lỗi: [{Code}] {Detail}", ex.StatusCode, ex.Status.Detail);
            throw;
        }
    }
}
```

---

### 4.6. Frontend (React Client): Gọi gRPC-Web qua Envoy
Tất cả các lời gọi từ React **KHÔNG gọi trực tiếp tới port của backend .NET** mà gọi qua **Envoy Gateway (`http://localhost:8080`)**:

```typescript
// web/src/api/userClient.ts
import { createPromiseClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { UserService } from "../gen/sudoku/user/v1/user_pb";

const transport = createGrpcWebTransport({
  baseUrl: "http://localhost:8080", // URL của Envoy Gateway
});

export const userClient = createPromiseClient(UserService, transport);

// Trong React Component:
const response = await userClient.getProfile({});
console.log(response.profile);
```

---

## 5. 🔄 Quy trình chuẩn khi thêm tính năng mới

Khi bạn cần thêm 1 API hoặc tính năng mới, tuân thủ đúng 5 bước sau:

1. **Bước 1 — Định nghĩa Proto**:
   * Mở file `.proto` tương ứng trong thư mục `proto/` (hoặc tạo file mới).
   * Khai báo message Request, Response và method `rpc`.
2. **Bước 2 — Biên dịch Proto**:
   * Backend .NET sẽ tự động biên dịch Proto khi build (nhờ `Grpc.Tools` trong `.csproj`).
   * Với Frontend: Chạy lệnh `npm run gen` trong thư mục `web/` để tạo các file TypeScript type-safe trong `web/src/gen/`.
3. **Bước 3 — Viết Data & Domain**:
   * Tạo Entity / migration trong `Data/`.
   * Viết Business logic / Use case trong `Domain/`.
4. **Bước 4 — Expose API qua `Grpc/`**:
   * Kế thừa method vừa tạo trong `*GrpcService.cs`, gọi xuống Domain service.
   * Đăng ký DI trong `Program.cs`.
5. **Bước 5 — Cập nhật Gateway & Frontend**:
   * Đảm bảo route trong `gateway/envoy.yaml` đã map tới service tương ứng (thường đã map sẵn wildcard prefix).
   * Viết UI component gọi gRPC client từ React.

---

## 6. 🚀 Hướng dẫn Chạy dự án (Local Development)

### 1. Khởi động Hạ tầng (Database, Kafka, Redis, Envoy Gateway):
```powershell
cd D:\GitHub\PRN_ASM\deploy
docker compose up -d
```
* Envoy Gateway sẽ lắng nghe tại: `http://localhost:8080`
* PostgreSQL: `localhost:5432`
* Kafka: `localhost:9092`

### 2. Chạy Backend Services:
Mở solution `PRN_ASM.sln` bằng Visual Studio / Rider hoặc chạy terminal:
```powershell
# Chạy Game Service (Port 5101)
dotnet run --project services/Game/Game.Api

# Chạy User Service (Port 5102)
dotnet run --project services/User/User.Api

# Chạy Multiplayer Service (Port gRPC 5105 / SignalR 5115)
dotnet run --project services/Multiplayer/Multiplayer.Api

# Chạy Support Service (Port 5104)
dotnet run --project services/Support/Support.Api
```

### 3. Chạy Frontend (Web):
```powershell
cd D:\GitHub\PRN_ASM\web
npm install
npm run dev
```
Truy cập giao diện web tại: `http://localhost:5173`

---

## 7. 🛡️ Quy chuẩn Code (Coding Standards)

* **Clean Code & DTO Separation**: Không trả trực tiếp EF Core Entity ra ngoài gRPC. Luôn map từ Entity sang Protobuf Message.
* **Exceptions**: Trong `GrpcService`, luôn chuyển đổi domain exception thành `RpcException` với mã lỗi chuẩn (`StatusCode.NotFound`, `StatusCode.InvalidArgument`, `StatusCode.Unauthenticated`).
* **Environment Configuration**: Không hardcode chuỗi kết nối hay secret key. Luôn đọc từ `appsettings.json` hoặc Environment Variables.

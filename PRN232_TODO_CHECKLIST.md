# 📋 PRN232 FINAL ASSIGNMENT — TÀI LIỆU TỔNG HỢP XỬ LÝ CÁC VẤN ĐỀ CÒN THIẾU

Tài liệu này liệt kê chi tiết toàn bộ các hạng mục kỹ thuật cần **sửa đổi và bổ sung** để dự án **PRN_ASM** đáp ứng trọn vẹn 100% yêu cầu chấm điểm của đề bài **PRN232 – Final Assignment**.

---

## 🎯 Tóm tắt 2 Vấn đề Trọng tâm cần xử lý

1. **Vấn đề 1 — Chuyển `Support.Api` về ASP.NET Core REST API thuần + Swagger + Gọi gRPC liên service** *(Giải quyết Mục 2.1, 2.4, 5 & 6 — Trọng số: 35% tổng điểm)*:
   - Hiện tại `Support.Api` vẫn đang dính khung gRPC Server cũ (`Grpc/SupportGrpcService.cs`, `support.proto`, Kestrel `Http2`) từ commit khởi tạo ban đầu.
   - Cần **gỡ bỏ hoàn toàn gRPC Server khỏi `Support.Api`**, chuyển về **ASP.NET Core Web API (RESTful) thuần**, có **Swagger/OpenAPI**, **Layered Architecture** (`Controllers` ➔ `Domain/Services` ➔ `Data/Repositories` + `UnitOfWork`), **CRUD**, **Searching / Filtering / Sorting / Pagination**, dùng **gRPC Client** gọi sang `Game.Api` & `User.Api`, và tái sử dụng **`AddFirebaseJwt` có sẵn từ `building-block/Sudoku.Auth`** để gắn `[Authorize]` cho các REST Controller.
2. **Vấn đề 2 — Hoàn thiện luồng Message Broker (Apache Kafka) Producer & Consumer End-to-End** *(Giải quyết Mục 2.2, 2.3 & 6 — Trọng số: 25% tổng điểm)*:
   - Hiện tại `Game.Api` mới chỉ lưu bản ghi `OutboxMessage` vào PostgreSQL (`game_db`), chưa có Kafka Producer thật và `User.Api` chưa có Kafka Consumer.
   - Cần hoàn thiện `KafkaEventPublisher` (trong `Sudoku.Messaging`), `OutboxRelayWorker` (tại `Game.Api`) và `GameEventsConsumerWorker` + `InboxMessage` Idempotency (tại `User.Api`).

---

## 🛠️ PHẦN 1: CHUYỂN `Support.Api` VỀ ASP.NET CORE REST API THUẦN & TƯƠNG TÁC REST ➔ gRPC

### 1.1. Dọn dẹp khung gRPC Server cũ khỏi `Support.Api`
- [ ] **Xóa các file/cấu hình gRPC Server không còn dùng ở `Support.Api`**:
  - Xóa file `services/Support/Support.Api/Grpc/SupportGrpcService.cs` (và thư mục `Grpc/` trong `Support.Api`).
  - Xóa file `proto/sudoku/support/v1/support.proto` (hoặc gỡ khỏi `Support.Api.csproj`, lưu ý kiểm tra nếu gỡ `support.proto` thì xóa route `/sudoku.support.v1.` trong `gateway/envoy.yaml`).
  - Trong `gateway/envoy.yaml`: Đổi route của `support` sang prefix `/api/v1/` (HTTP/1.1) hoặc mở trực tiếp port `5104:8080` trong `deploy/docker-compose.yml` để truy cập Swagger UI trực tiếp tại `http://localhost:5104/swagger`.
- [ ] **Cập nhật `services/Support/Support.Api/appsettings.json` và `appsettings.Development.json`**:
  - Đổi Kestrel `Protocols` từ `"Http2"` sang `"Http1"` (chuẩn ASP.NET Core REST API thuần).
  - Bổ sung cấu hình địa chỉ các gRPC Service đích để `Support.Api` gọi tới:
    - Trong `appsettings.Development.json`:
      ```json
      "Services": {
        "Game": "http://localhost:5101",
        "User": "http://localhost:5102"
      }
      ```
    - Trong `appsettings.json` (Docker):
      ```json
      "Services": {
        "Game": "http://game-service:8080",
        "User": "http://user-service:8080"
      }
      ```

### 1.2. Cập nhật `services/Support/Support.Api/Support.Api.csproj`
- [ ] Gỡ bỏ `<PackageReference Include="Grpc.AspNetCore" />` và `<Protobuf Include="...support.proto" GrpcServices="Server" />`.
- [ ] Bổ sung các package cho **ASP.NET Core REST API, Swagger/OpenAPI, EF Core PostgreSQL**, và **gRPC Client** (chỉ đóng vai trò Client gọi sang `Game.Api` và `User.Api`):
  ```xml
  <ItemGroup>
    <Protobuf Include="../../../proto/sudoku/game/v1/game.proto" ProtoRoot="../../../proto" GrpcServices="Client" />
    <Protobuf Include="../../../proto/sudoku/user/v1/user.proto" ProtoRoot="../../../proto" GrpcServices="Client" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="EFCore.NamingConventions" Version="8.0.3" />
    <PackageReference Include="Google.Protobuf" Version="3.27.2" />
    <PackageReference Include="Grpc.Net.ClientFactory" Version="2.57.0" />
    <PackageReference Include="Grpc.Tools" Version="2.64.0" PrivateAssets="all" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="8.0.11" PrivateAssets="all" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.11" />
    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.6.2" />
  </ItemGroup>
  ```

### 1.3. Xây dựng Layered Architecture (`Controllers` – `Domain` – `Data`) tại `Support.Api`
Tuân thủ quy chuẩn kiến trúc phân tầng của đề bài (Mục 2.1) và `AGENTS.md`:

```text
services/Support/Support.Api/
├── Controllers/
│   ├── TutorialsController.cs        # RESTful CRUD + Search, Filter, Sort, Pagination + JWT
│   ├── NoticesController.cs          # RESTful CRUD + Search, Filter, Sort, Pagination + JWT
│   └── PortalController.cs           # REST endpoint gọi gRPC Client sang Game.Api & User.Api
├── Contracts/                        # DTOs cho REST Request/Response (không lộ EF Entity ra ngoài)
│   ├── PagedResponse.cs
│   ├── TutorialDtos.cs
│   ├── NoticeDtos.cs
│   └── PortalDtos.cs
├── Domain/
│   ├── Entities/
│   │   ├── Tutorial.cs
│   │   └── SystemNotice.cs
│   ├── Exceptions/
│   │   └── SupportDomainException.cs
│   └── Services/
│       ├── Interfaces.cs
│       ├── TutorialService.cs
│       └── NoticeService.cs
├── Data/
│   ├── Configurations/
│   │   ├── TutorialConfiguration.cs
│   │   └── SystemNoticeConfiguration.cs
│   ├── Repositories/
│   │   ├── TutorialRepository.cs
│   │   └── NoticeRepository.cs
│   ├── Migrations/                   # EF Core Migrations cho support_db
│   ├── SupportDbContext.cs
│   ├── SupportUnitOfWork.cs
│   └── SupportDataSeeder.cs          # IHostedService tự động migrate + seed dữ liệu mẫu khi chạy
└── Program.cs
```

- [ ] **Tầng Data (`Data/`)**:
  - Tạo `SupportDbContext` (schema `"support"`), cấu hình Fluent API cho bảng `tutorials` và `system_notices`.
  - Tạo Migration trong `Data/Migrations/` và `SupportDataSeeder : IHostedService` tự động `MigrateAsync()` + seed sẵn dữ liệu mẫu (các kỹ thuật giải Sudoku: Naked Single, Hidden Single, Pointing Pairs, X-Wing... và các thông báo hệ thống) để có sẵn dữ liệu demo ngay khi bật container.
  - Tạo `SupportUnitOfWork` (Repository không tự gọi `SaveChangesAsync()`, chỉ gom 1 lần qua `ISupportUnitOfWork` ở Domain Service).
  - Trong `TutorialRepository` và `NoticeRepository`:
    - Các truy vấn đọc bắt buộc có `.AsNoTracking()`, projection sang DTO và giới hạn `Math.Clamp(pageSize, 1, 50)`.
    - Hỗ trợ đầy đủ:
      1. **Searching**: Tìm theo từ khóa trong `Title`, `Summary` / `Content` (`?search=...`).
      2. **Filtering**: Lọc theo `Category`, `Difficulty`, `IsPublished` (`?category=...&difficulty=...&isPublished=...`).
      3. **Sorting**: Sắp xếp theo `sortOrder`, `title`, `createdAt` cùng chiều `asc` / `desc` (`?sortBy=createdAt&sortDir=desc`).
      4. **Pagination**: Phân trang `Skip((page - 1) * pageSize).Take(pageSize)` kèm tổng số bản ghi `totalCount`, `totalPages` (`?page=1&pageSize=10`).
- [ ] **Tầng Domain (`Domain/`)**:
  - Tạo `TutorialService` và `NoticeService` xử lý validate dữ liệu đầu vào, ném custom exception (`NotFoundException`, `ValidationException`) khi dữ liệu không hợp lệ hoặc không tìm thấy.
- [ ] **Tầng API (`Controllers/` & `Program.cs`)**:
  - Tạo `TutorialsController` (`/api/v1/tutorials`) và `NoticesController` (`/api/v1/notices`) chuẩn RESTful:
    - `GET /api/v1/tutorials` (`[AllowAnonymous]`) — Danh sách có Search, Filter, Sort, Pagination.
    - `GET /api/v1/tutorials/{id:guid}` (`[AllowAnonymous]`) — Chi tiết theo ID (`200 OK` / `404 NotFound`).
    - `POST /api/v1/tutorials` (`[Authorize]`) — Tạo mới (`201 CreatedAtAction`).
    - `PUT /api/v1/tutorials/{id:guid}` (`[Authorize]`) — Cập nhật (`200 OK` / `404 NotFound`).
    - `DELETE /api/v1/tutorials/{id:guid}` (`[Authorize]`) — Xóa (`204 NoContent` / `404 NotFound`).
  - Tạo `PortalController` (`/api/v1/portal`) để **chứng minh tương tác giữa REST API và gRPC Service (Mục 2.4 đề bài)**:
    - `GET /api/v1/portal/leaderboard?levelId=easy&limit=10`: Dùng `GameService.GameServiceClient` gọi gRPC sang `Game.Api` (`ListLevelsAsync` & `GetHighScoresAsync` với `deadline: DateTime.UtcNow.AddSeconds(3)` và `CancellationToken`).
    - `GET /api/v1/portal/me` (`[Authorize]`): Trích xuất Bearer token từ HTTP Request hiện tại, đính kèm vào `Metadata` (`authorization`) và dùng `UserService.UserServiceClient` gọi gRPC sang `User.Api` (`GetProfileAsync`) kết hợp với dữ liệu từ `support_db` để trả về JSON tổng hợp.
  - Cấu hình **Exception Handling Middleware / ProblemDetails** trong `Program.cs` để chuyển `NotFoundException` ➔ `404`, `ValidationException` ➔ `400`, `RpcException` ➔ mã HTTP tương ứng.
  - Cấu hình **Swagger/OpenAPI** (`AddSwaggerGen`) có khai báo `OpenApiSecurityScheme` (nút **Authorize** trên giao diện Swagger UI) để khi chấm bài có thể dán Bearer Token vào test các REST API gắn `[Authorize]` (xác thực JWT đã được xử lý sẵn bởi `builder.Services.AddFirebaseJwt(builder.Configuration)` trong `building-block/Sudoku.Auth`, **không viết lại logic JWT mới**).

---

## 📬 PHẦN 2: HOÀN THIỆN MESSAGE BROKER (APACHE KAFKA) PRODUCER & CONSUMER

### 2.1. Hoàn thiện `building-block/Sudoku.Messaging`
- [ ] Cập nhật `building-block/Sudoku.Messaging/Sudoku.Messaging.csproj`:
  - Thêm `<FrameworkReference Include="Microsoft.AspNetCore.App" />` để dùng `IConfiguration`, `IServiceCollection`, `ILogger`.
- [ ] Tạo `building-block/Sudoku.Messaging/KafkaEventPublisher.cs` thực thi `IEventPublisher`:
  - Khởi tạo `IProducer<string, byte[]>` từ `Confluent.Kafka` với `BootstrapServers` đọc từ `config["Kafka:BootstrapServers"] ?? "localhost:9092"`, `Acks = Acks.All`, `EnableIdempotence = true`.
  - Khi `PublishAsync(string topic, EventEnvelope @event, CancellationToken ct)` được gọi: gửi message lên Kafka với `Key = @event.UserId`, `Value = @event.Payload`, và đính kèm Kafka Headers (`eventId`, `type`, `userId`, `occurredAt`).
- [ ] Tạo `building-block/Sudoku.Messaging/MessagingExtensions.cs`:
  - Cung cấp extension method `AddSudokuKafkaPublisher(this IServiceCollection services)` đăng ký `Singleton<IEventPublisher, KafkaEventPublisher>`.

### 2.2. Bổ sung `OutboxRelayWorker` tại `services/Game/Game.Api` (Producer Side)
- [ ] Trong `IGameSessionRepository` và `GameSessionRepository`:
  - Thêm hàm `Task<List<OutboxMessage>> GetPendingOutboxMessagesAsync(int batchSize, CancellationToken ct = default)` truy vấn các bản ghi `OutboxMessages` có `ProcessedAt == null`, sắp xếp theo `CreatedAt` tăng dần, `.Take(Math.Clamp(batchSize, 1, 100))`.
- [ ] Tạo `services/Game/Game.Api/Messaging/OutboxRelayWorker.cs` kế thừa `BackgroundService`:
  - Định kỳ quét các `OutboxMessage` chưa xử lý (`ProcessedAt == null`).
  - Dùng `IEventPublisher.PublishAsync` bắn message lên Kafka topic `sudoku.events`.
  - Cập nhật `msg.ProcessedAt = DateTime.UtcNow`, `msg.Error = null` (hoặc lưu `msg.Error` nếu Kafka tạm thời chưa sẵn sàng) và gọi `await uow.SaveChangesAsync(stoppingToken)` một lần cho cả batch.
- [ ] Trong `services/Game/Game.Api/Program.cs`:
  - Đăng ký `builder.Services.AddSudokuKafkaPublisher();` và `builder.Services.AddHostedService<OutboxRelayWorker>();`.

### 2.3. Bổ sung `InboxMessage` & `GameEventsConsumerWorker` tại `services/User/User.Api` (Consumer Side)
- [ ] **Cập nhật Database & Migration của `User.Api`**:
  - Thêm `public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();` vào `services/User/User.Api/Data/UserDbContext.cs`.
  - Tạo `services/User/User.Api/Data/Configurations/InboxMessageConfiguration.cs` cấu hình bảng `inbox_messages` trong schema `"user"` với khóa chính phức hợp `HasKey(x => new { x.EventId, x.HandlerName })`.
  - Tạo EF Core Migration mới trong `services/User/User.Api/Data/Migrations/` cho bảng `inbox_messages`.
- [ ] **Cập nhật Repository & Domain Service của `User.Api`**:
  - Trong `IUserRepository` / `UserRepository`:
    - Thêm `Task<bool> HasProcessedEventAsync(string eventId, string handlerName, CancellationToken ct)`.
    - Thêm `Task AddInboxMessageAsync(InboxMessage message, CancellationToken ct)`.
  - Trong `IUserProfileService` / `UserProfileService`:
    - Thêm `Task ApplyGameFinishedEventAsync(string eventId, string handlerName, GameFinished evt, CancellationToken ct)`:
      1. Kiểm tra `HasProcessedEventAsync(eventId, handlerName, ct)` — nếu đã tồn tại thì return ngay (đảm bảo **Idempotent Inbox** theo Luật 5 của `AGENTS.md`).
      2. Tìm `UserAccount` theo `FirebaseUid == evt.UserId` (`GetByFirebaseUidForUpdateAsync`). Nếu user chưa tồn tại trong `user_db`, tự động khởi tạo `UserAccount` mới cho `evt.UserId`.
      3. Cập nhật thống kê:
         - `user.TotalGames += 1`
         - Nếu `evt.IsWin`: `user.Wins += 1`, `user.TotalExp += Math.Max(10, evt.Score / 5)`, `user.PlayerLevel = 1 + (user.TotalExp / 500)`, `user.Trophies += Math.Max(0, evt.RewardCoins)`.
         - `user.UpdatedAt = DateTimeOffset.UtcNow`.
      4. Ghi `InboxMessage` (`EventId = eventId`, `HandlerName = handlerName`, `ReceivedAt = DateTime.UtcNow`, `ProcessedAt = DateTime.UtcNow`).
      5. Gọi `await unitOfWork.SaveChangesAsync(ct)` **1 lần duy nhất** để commit cả thay đổi của `UserAccount` và `InboxMessage` trong cùng transaction.
- [ ] **Tạo `services/User/User.Api/Messaging/GameEventsConsumerWorker.cs` kế thừa `BackgroundService`**:
  - Khởi tạo `IConsumer<string, byte[]>` của `Confluent.Kafka` (`GroupId = "user-service-consumer-group"`, `AutoOffsetReset = AutoOffsetReset.Earliest`, `EnableAutoCommit = false`, `AllowAutoCreateTopics = true`).
  - Subscribe vào topic `sudoku.events`.
  - Đọc Kafka Header `eventId` và `type` (nếu `type == nameof(GameFinished)`), giải mã `GameFinished.Parser.ParseFrom(consumeResult.Message.Value)`, mở DI Scope gọi `IUserProfileService.ApplyGameFinishedEventAsync(...)`, sau đó `consumer.Commit(consumeResult)`.
  - Đăng ký `builder.Services.AddHostedService<GameEventsConsumerWorker>();` trong `services/User/User.Api/Program.cs`.

---

## 🐳 PHẦN 3: CẬP NHẬT HẠ TẦNG & TÀI LIỆU ĐỒNG BỘ

- [ ] **Cập nhật `deploy/docker-compose.yml`**:
  - Map port cho `support-service` (`ports: - '5104:8080'`) để khi chạy Docker Compose có thể mở thẳng `http://localhost:5104/swagger` trình diễn REST API.
  - Đảm bảo biến môi trường hoặc `appsettings.json` của `support-service`, `game-service`, `user-service` trỏ đúng tới `postgres`, `kafka:9092`, `game-service:8080`, `user-service:8080`.
- [ ] **Cập nhật bảng kiến trúc tại `AGENTS.md` và `docs/ARCHITECTURE.md`**:
  - Ghi nhận rõ `Support.Api` (`5104`) là **ASP.NET Core REST API + Swagger** (gọi gRPC Client sang `Game.Api` và `User.Api`).

---

## ✅ PHẦN 4: QUY TRÌNH NGHIỆM THU CUỐI CÙNG (BẮT BUỘC)

> [!IMPORTANT]
> **LƯU Ý BẮT BUỘC SAU KHI HOÀN TẤT:**
> Sau khi đã xử lý xong toàn bộ các task được liệt kê trong file `.md` này:
> 1. **Review & Kiểm tra lại toàn bộ hệ thống 1 lần nữa**:
>    - Chạy `dotnet build PRN_ASM.sln` đảm bảo pass 100% không có lỗi biên dịch.
>    - Chạy `cd web; npm run build` và `npm run lint` đảm bảo Frontend không bị ảnh hưởng.
>    - Đối chiếu lại từng mục với đề bài **PRN232 – Final Assignment** (REST API + CRUD + Search/Filter/Sort/Pagination + JWT + Swagger, Background Job, Kafka Producer/Consumer qua Outbox/Inbox, tương tác giữa REST API và gRPC Service, Docker Compose) và 12 luật bắt buộc trong `AGENTS.md`.
> 2. **Xóa file `PRN232_TODO_CHECKLIST.md` này khỏi repository** sau khi quá trình review xác nhận mọi thứ đã hoàn tất.

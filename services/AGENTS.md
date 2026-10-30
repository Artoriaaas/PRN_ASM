# Backend Microservices Rules (`services/`)

File này tự động nạp khi làm việc trong `services/**`. Kế thừa luật gốc từ `/AGENTS.md`.

## Cấu trúc 4 Layer trong mỗi `<Service>.Api`
- **`Grpc/` (`*GrpcService.cs`)**: Thin adapter.
  - Đọc Firebase UID từ `context.GetHttpContext().User.FindFirst("sub")?.Value` (không dùng `ClaimTypes.NameIdentifier` vì `MapInboundClaims = false`).
  - Validate input cơ bản, gọi Domain service kèm `context.CancellationToken`, trả Protobuf message.
  - Dịch lỗi nghiệp vụ sang `RpcException` (`StatusCode.NotFound`, `InvalidArgument`, `FailedPrecondition`, `PermissionDenied`, `Unauthenticated`).
- **`Hubs/` (`MatchHub.cs` ở `Multiplayer.Api`)**:
  - Đọc user từ `Context.User?.FindFirst("sub")?.Value` (token qua query `?access_token=...`).
  - **Hot path (`< 15ms`)**: giữ state bàn cờ/phòng trên RAM + Redis (`match:room:session:{id}`), chỉ broadcast delta nhỏ (`{ i, v }` hoặc tiến độ). **Cấm** gọi `DbContext` / `SaveChangesAsync()` mỗi nước đi.
- **`Domain/`**: Entities, ValueObjects, Exceptions, Domain Services & Interfaces (`IUnitOfWork`, `I*Repository`). Không phụ thuộc chi tiết HTTP/Envoy.
- **`Data/`**: `DbContext` riêng cho từng DB (`game_db`, `user_db`, `multiplayer_db`, `support_db`), `Configurations/`, `Repositories/`, `UnitOfWork<TDbContext>`.
- **`Messaging/`**: Outbox worker & Kafka consumers/handlers.

## Quy tắc EF Core & PostgreSQL (chi tiết: `docs/OPTIMIZATION.md` §2)
1. **Read path**: 100% có `.AsNoTracking()`, `.Select(...)` chiếu thẳng sang Protobuf/Read DTO (bỏ qua cột `JSONB` nặng như lịch sử nước đi khi chỉ lấy danh sách), và `.Take(limit)`. Cấm `GetAll()` không filter.
2. **Write path**: Gom Repository theo Aggregate Root (2–5 repo/service). Repository **không** tự gọi `SaveChangesAsync()` và không gọi `_ctx.Update(entity)` tràn lan trên entity đang được track. Domain service chốt **1 lần** `await uow.SaveChangesAsync(ct)`.
3. **Đa luồng**: Không `Task.WhenAll` trên cùng 1 scoped `DbContext`; nếu cần song song phải dùng `IDbContextFactory<TDbContext>`.
4. **Index**: Mọi cặp cột lọc + sắp xếp (`WHERE` + `ORDER BY`) mới phải có Composite/Partial Index trong Migration.
   - `outbox_messages`: Partial Index `(created_at ASC) WHERE processed_at IS NULL`.
   - `inbox_messages`: `UNIQUE (event_id, handler_name)`.

## Giao tiếp Liên Service
- **Bất đồng bộ (ưu tiên khi cập nhật thống kê/tích lũy)**:
  - Ghi `OutboxMessage` (`Topic = "sudoku.events"`, `Type = nameof(GameFinished)`, `Payload = eventMsg.ToByteArray()`) **chung transaction** với dữ liệu nghiệp vụ.
  - Consumer kiểm tra `InboxMessage` (`EventId`, `HandlerName`) để đảm bảo idempotent.
- **Đồng bộ (gRPC Client)**:
  - Khai báo `<Protobuf ... GrpcServices="Client" />` trong `.csproj`.
  - Đăng ký `AddGrpcClient<TClient>` đọc địa chỉ từ `Configuration["Services:<Name>"]` (`Services:User`, `Services:Game`).
  - Mọi lời gọi phải truyền `deadline: DateTime.UtcNow.AddSeconds(3)` + `cancellationToken: ct` và bắt `RpcException`.

Code mẫu từng layer: xem `docs/HANDOFF.md` §4.

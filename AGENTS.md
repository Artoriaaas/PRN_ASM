# PRN_ASM — Sudoku Online Platform: Agent Rules

File này luôn được agent nạp. Chỉ chứa **luật bắt buộc + bản đồ tài liệu**. Chi tiết nằm trong `docs/` — chỉ đọc khi task liên quan.

## Stack
.NET 8 (C# 12) · gRPC + Protobuf (contract-first) · SignalR · EF Core + PostgreSQL 16 · Kafka 3.9 · Redis 7 · Envoy (gRPC-Web, JWT) · Firebase Auth · OpenTelemetry · React 19 + TS + Vite + ConnectRPC v2.

## Bản đồ dự án & Port
| Thành phần | Đường dẫn | Local | Docker | Database |
| :--- | :--- | :--- | :--- | :--- |
| Envoy Gateway | `gateway/envoy.yaml` | 8080 | 8080 | — |
| Game | `services/Game/Game.Api` | 5101 | 8080 | `game_db` |
| User | `services/User/User.Api` | 5102 | 8080 | `user_db` |
| Support | `services/Support/Support.Api` | 5104 | 8080 | `support_db` |
| Multiplayer | `services/Multiplayer/Multiplayer.Api` | 5105 gRPC / 5115 SignalR | 8080 / 8081 | `multiplayer_db` |
| Web | `web/` | 5173 | — | — |

- Proto (nguồn chân lý API & event): `proto/sudoku/<domain>/v1/*.proto`. Kafka topic: `sudoku.events`.
- Building blocks: `building-block/Sudoku.{Auth,Messaging,Observability}`.
- URL service khác đọc từ config key `Services:<Name>` (vd `Services:User`).

## Luật bắt buộc (không được vi phạm)
1. **Contract-first**: đổi API/event ⇒ sửa `.proto` trước. Không tự định nghĩa DTO song song với Protobuf.
2. **Không trả EF Entity ra gRPC** — luôn map/`.Select()` sang Protobuf message.
3. **Read query**: bắt buộc `.AsNoTracking()` + projection + `Take(limit)`. Cấm `GetAll()` không filter.
4. **Write**: Repository không gọi `SaveChangesAsync()`; gom 1 lần qua `IUnitOfWork` ở Domain service.
5. **Event liên service**: ghi `OutboxMessage` cùng transaction, không publish Kafka trực tiếp trong request. Consumer phải check `InboxMessage` (idempotent).
6. **Hot path (SignalR Hub)**: không chạm `DbContext`/PostgreSQL mỗi nước đi — dùng RAM/Redis.
7. **Database-per-service**: không truy cập DB của service khác; dùng gRPC client hoặc Kafka.
8. **Luôn truyền `CancellationToken`** (`context.CancellationToken`) xuống tới DB/gRPC client; gọi gRPC liên service phải có `deadline`.
9. **Lỗi**: domain exception ⇒ `RpcException` với `StatusCode` chuẩn (`NotFound`, `InvalidArgument`, `Unauthenticated`…).
10. **Không hardcode** connection string/secret/URL — đọc từ `appsettings*.json` / env.
11. UserId lấy từ JWT claim **`sub`** (Firebase UID), **không** nhận từ request body. Không dùng `ClaimTypes.NameIdentifier` (sẽ `null` vì `MapInboundClaims = false`).
12. Không sửa file sinh tự động: `web/src/gen/**`, `obj/**`, `bin/**`.

## Khi nào đọc tài liệu nào
| Task | Đọc |
| :--- | :--- |
| Thêm/sửa API gRPC end-to-end | skill `add-grpc-feature` + `docs/HANDOFF.md` §3–5 |
| Code `Grpc/`, `Domain/`, `Data/`, `Messaging/`, gọi service khác | `docs/HANDOFF.md` §3–4 |
| Query EF, index, Redis, cache, hiệu năng FE | `docs/OPTIMIZATION.md` |
| Dùng/mở rộng Auth, Messaging, Observability; tạo building block mới | `docs/BUILDING_BLOCKS.md` |
| Hiểu tổng thể kiến trúc, luồng auth/event | `docs/ARCHITECTURE.md` |
| Chạy dự án local | `docs/HANDOFF.md` §6 |

## Kiểm tra trước khi kết thúc task
- Backend: `dotnet build PRN_ASM.sln` phải pass.
- Frontend: `cd web; npm run build` và `npm run lint`. Sửa proto ⇒ chạy `npm run gen` trong `web/`.
- Đổi port/config/kiến trúc ⇒ cập nhật bảng ở file này và `docs/` tương ứng.

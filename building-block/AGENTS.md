# Shared Building Blocks Rules (`building-block/`)

File này tự động nạp khi làm việc trong `building-block/**`. Chi tiết & code mẫu đầy đủ tại `docs/BUILDING_BLOCKS.md`.

## Nguyên tắc Bắt buộc
1. **Cross-Cutting Concerns Only**: Chỉ chứa hạ tầng dùng chung (`Sudoku.Auth`, `Sudoku.Messaging`, `Sudoku.Observability`, …). **Cấm** đưa logic nghiệp vụ đặc thù của từng microservice vào đây.
2. **Zero Circular Dependency**: Không bao giờ tham chiếu ngược lên `services/*`; hạn chế tối đa tham chiếu chéo giữa các building block.
3. **Chuẩn `.csproj`**: `net8.0`, `<Nullable>enable</Nullable>`, `<ImplicitUsings>enable</ImplicitUsings>`. Nếu cần dùng `IServiceCollection` / middleware ASP.NET Core thì khai báo `<FrameworkReference Include="Microsoft.AspNetCore.App" />`.
4. **Chuẩn DI Extension**: Mọi chức năng cung cấp ra ngoài qua static class `*Extensions.cs` (`AddFirebaseJwt`, `AddSudokuObservability`, `AddSudoku*`), đọc cấu hình từ `IConfiguration`, không hardcode endpoint/secret.

## Lưu ý Kỹ thuật của từng Module
- **`Sudoku.Auth`**:
  - Đặt `MapInboundClaims = false` ⇒ giữ nguyên tên claim chuẩn của Firebase JWT (`sub`, `user_id`, `email`, `role`). Mọi helper trích xuất claim phải đọc `"sub"` / `"email"`, **không** đọc `ClaimTypes.NameIdentifier` hay `ClaimTypes.Email`.
  - Hỗ trợ SignalR WebSocket bằng cách đọc `access_token` từ query string cho các path bắt đầu bằng `/hubs`.
- **`Sudoku.Messaging`**:
  - Cung cấp `EventEnvelope`, `IEventPublisher`, `OutboxMessage`, `InboxMessage`.
  - Kafka producer phải bật `Acks = Acks.All` và `EnableIdempotence = true`, lấy địa chỉ từ `Configuration["Kafka:BootstrapServers"]`.
- **`Sudoku.Observability`**:
  - Cấu hình OpenTelemetry Resource + Tracing + Metrics, chỉ gắn OTLP Exporter khi `Configuration["Otel:Endpoint"]` có giá trị (để chạy local không có collector vẫn không lỗi).

## Tạo Building Block Mới
1. `dotnet new classlib -n Sudoku.<Name> -o building-block/Sudoku.<Name>`
2. `dotnet sln PRN_ASM.sln add building-block/Sudoku.<Name>/Sudoku.<Name>.csproj`
3. Viết `<Name>Extensions.cs` đăng ký DI và cập nhật `docs/BUILDING_BLOCKS.md` + `/AGENTS.md`.

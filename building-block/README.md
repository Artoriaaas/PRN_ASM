# 🧩 Building Blocks

Thư mục này chứa các thư viện dùng chung (Cross-Cutting Concerns) cho toàn bộ microservices của dự án **PRN_ASM**:

- **`Sudoku.Auth`**: Xác thực Firebase JWT Bearer Token, hỗ trợ gRPC, Controller và WebSocket SignalR Hub (`/hubs`).
- **`Sudoku.Messaging`**: Kafka Publisher, EventEnvelope, OutboxMessage & InboxMessage patterns.
- **`Sudoku.Observability`**: OpenTelemetry Distributed Tracing & Metrics qua OTLP Exporter.

👉 **Tài liệu hướng dẫn chi tiết về cách dùng, code mẫu và cách mở rộng tính năng mới:**  
Vui lòng xem tại: [BUILDING_BLOCKS.md (ở thư mục gốc)](../BUILDING_BLOCKS.md)

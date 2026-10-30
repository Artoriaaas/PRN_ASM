# 🧩 PRN_ASM — Sudoku Online & Realtime Multiplayer Platform

Nền tảng giải đố Sudoku trực tuyến kết hợp thi đấu đối kháng 1v1 thời gian thực, xây dựng theo kiến trúc **Event-Driven Microservices** và **Contract-First (gRPC & Protobuf)**.

## Tech Stack
- **Backend**: .NET 8 (C# 12), gRPC, SignalR, EF Core, PostgreSQL 16 (Database-per-service)
- **Messaging & Cache**: Apache Kafka 3.9 (Outbox/Inbox Pattern), Redis 7
- **Edge Gateway & Auth**: Envoy Proxy (gRPC-Web, CORS, WebSocket), Firebase Auth (JWT)
- **Observability**: OpenTelemetry (OTLP Tracing & Metrics)
- **Frontend**: React 19, TypeScript, Vite 8, `@connectrpc/connect-web` v2, `@microsoft/signalr`

## 📚 Tài liệu Dự án (`docs/`)

| Tài liệu | Nội dung chính |
| :--- | :--- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Sơ đồ kiến trúc tổng thể, danh mục công nghệ, luồng xác thực & event-driven |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Quy ước 4 layer, code mẫu từng tầng, quy trình thêm tính năng & **hướng dẫn chạy local** |
| [docs/OPTIMIZATION.md](docs/OPTIMIZATION.md) | Ngân sách độ trễ (Hot/Cold path), chuẩn EF Core, Index PostgreSQL, Redis & tối ưu UI 81 ô |
| [docs/BUILDING_BLOCKS.md](docs/BUILDING_BLOCKS.md) | Cách dùng và mở rộng `Sudoku.Auth`, `Sudoku.Messaging`, `Sudoku.Observability` |

## 🤖 Hỗ trợ AI Coding Agent
Dự án được cấu hình phân tầng theo cơ chế **Progressive Disclosure** (tiết kiệm context token tối đa cho AI Agent):
- [AGENTS.md](AGENTS.md): Luật bắt buộc toàn cục & bảng định tuyến tài liệu.
- Luật theo phạm vi thư mục: [services/AGENTS.md](services/AGENTS.md), [web/AGENTS.md](web/AGENTS.md), [building-block/AGENTS.md](building-block/AGENTS.md).
- On-demand Skill: [.agents/skills/add-grpc-feature/SKILL.md](.agents/skills/add-grpc-feature/SKILL.md).

# 🧩 PRN_ASM — Sudoku Online & Realtime Multiplayer Platform

Nền tảng giải đố Sudoku trực tuyến kết hợp thi đấu đối kháng 1v1 thời gian thực, xây dựng theo kiến trúc **Event-Driven Microservices** và **Contract-First (gRPC & Protobuf)**.

## 🛠️ Tech Stack
- **Backend Framework**: ASP.NET Core (.NET 8, C# 12)
- **Inter-service & API**: gRPC & Protocol Buffers (Contract-First), SignalR WebSockets (Realtime)
- **Data Persistence**: Entity Framework Core, PostgreSQL 16 (Database-per-service pattern: `game_db`, `user_db`, `support_db`, `multiplayer_db`)
- **Event Bus & Messaging**: Apache Kafka 3.9 (Transactional Outbox & Idempotent Inbox Pattern)
- **Caching**: Redis 7 (Rating leaderboard cache, runtime match session)
- **Gateway & Security**: Envoy Gateway (gRPC-Web transcoding, CORS, WebSocket upgrade), Firebase Auth (JWT)
- **Observability**: OpenTelemetry (OTLP Tracing & Metrics)
- **Frontend**: React 19, TypeScript, Vite 8, `@connectrpc/connect-web` v2, `@microsoft/signalr`
- **Containerization**: Docker & Docker Compose

---

## 👥 Phân Công Trách Nhiệm Thành Viên (Team Member Responsibilities)

| Thành viên | Vai trò & Trách nhiệm chính |
| :--- | :--- |
| **Phạm Gia Huy** | • Thiết kế kiến trúc tổng thể Microservices & System Design<br>• Core Engine (`Sudoku.Core`), Solo Game Service (`Game.Api`) & Seeder<br>• Building Blocks (`Sudoku.Auth`, `Sudoku.Messaging`, `Sudoku.Observability`)<br>• Message Broker integration (Kafka Outbox & Inbox Worker) |
| **Mai Tuấn Vỹ (tuanvy)** | • Realtime Multiplayer Service (`Multiplayer.Api`) & SignalR Hub (`/hubs/match`)<br>• Thuật toán Matchmaking, Elo Rating & Redis Leaderboard Cache<br>• Tích hợp gRPC inter-service communication (Multiplayer ➔ Game/User) |
| **Nguyễn Tuấn Kiệt (KietNTSE)** | • Xây dựng Frontend Single Page Application (React 19 + TypeScript + Vite)<br>• Giao diện bàn cờ Sudoku tương tác, Smart Hint visualizer, Solo & Multiplayer pages<br>• Tích hợp `@connectrpc/connect-web` client & SignalR realtime events |
| **Phong (PhongSE192969)** | • User Service (`User.Api`), hồ sơ cá nhân & tích hợp Firebase Authentication<br>• Xử lý luồng đồng bộ sự kiện người chơi & thống kê trận đấu từ Kafka |

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án (Installation & Deployment Guide)

### 1. Yêu cầu Tiền đề (Prerequisites)
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js (v20+)](https://nodejs.org/) & npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (hỗ trợ Docker Compose v2)

### 2. Khởi chạy Toàn Bộ Hạ Tầng Bằng Docker Compose
Chỉ cần 1 lệnh để khởi chạy PostgreSQL (4 databases), Redis, Kafka broker và Envoy Gateway:
```powershell
cd deploy
docker compose up -d
```
- **Envoy Gateway**: `http://localhost:8080`
- **PostgreSQL 16**: `localhost:5432` (`postgres` / `postgres`)
- **Kafka 3.9**: `localhost:9092`
- **Redis 7**: `localhost:6379`

### 3. Khởi chạy Backend Services (Local Development)
Mở các terminal riêng biệt để chạy từng microservice:
```powershell
# 1. Game Service (Solo Sudoku Engine)
dotnet run --project services/Game/Game.Api

# 2. User Service (Player Profiles & Stats)
dotnet run --project services/User/User.Api

# 3. Multiplayer Service (1v1 Duel, SignalR)
dotnet run --project services/Multiplayer/Multiplayer.Api

# 4. Support Service
dotnet run --project services/Support/Support.Api
```

### 4. Khởi chạy Frontend Web Client
```powershell
cd clients
npm install
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:5173`

---

## 📚 Tài Liệu Chi Tiết (`docs/`)

| Tài liệu | Nội dung chính |
| :--- | :--- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Sơ đồ kiến trúc tổng thể, danh mục công nghệ, luồng xác thực & event-driven |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Quy ước 4 layer, code mẫu từng tầng, quy trình thêm tính năng & hướng dẫn chạy local |
| [docs/OPTIMIZATION.md](docs/OPTIMIZATION.md) | Ngân sách độ trễ (Hot/Cold path), chuẩn EF Core, Index PostgreSQL, Redis & tối ưu UI 81 ô |
| [docs/BUILDING_BLOCKS.md](docs/BUILDING_BLOCKS.md) | Cách dùng và mở rộng `Sudoku.Auth`, `Sudoku.Messaging`, `Sudoku.Observability` |
| [PRN232_TODO_CHECKLIST.md](PRN232_TODO_CHECKLIST.md) | Danh sách kiểm tra nghiệm thu theo yêu cầu đề bài PRN232 |

---

## 🤖 Hỗ Trợ AI Coding Agent
Dự án được cấu hình phân tầng theo cơ chế **Progressive Disclosure** (tiết kiệm context token tối đa cho AI Agent):
- [AGENTS.md](AGENTS.md): Luật bắt buộc toàn cục & bảng định tuyến tài liệu.
- Luật theo phạm vi thư mục: [services/AGENTS.md](services/AGENTS.md), [building-block/AGENTS.md](building-block/AGENTS.md).
- On-demand Skill: [.agents/skills/add-grpc-feature/SKILL.md](.agents/skills/add-grpc-feature/SKILL.md).

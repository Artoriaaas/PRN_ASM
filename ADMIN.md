# Tài liệu Tính năng Quản trị (Admin) — Sudoku Online Platform

Tài liệu này tổng hợp toàn bộ kiến trúc, API/RPC, cơ sở dữ liệu, sự kiện Kafka và giao diện quản trị (Admin Portal) đã được triển khai cho vai trò **ADMIN** trong hệ sinh thái Sudoku Microservice.

---

## 1. Nguyên tắc Kiến trúc

1. **Không tạo "Admin Service" riêng**: Mỗi tính năng admin được đặt tại microservice sở hữu dữ liệu tương ứng:
   - **User Service (`services/User/User.Api`)**: Quản lý tài khoản, trạng thái khóa (ban/unban), xóa mềm, cấp/thu quyền Admin, điều chỉnh Elo thủ công và ghi lịch sử Elo, tra cứu Audit Log.
   - **Game Service (`services/Game/Game.Api`)**: Quản lý biến thể game (GameModes), cấu hình độ khó (Levels), nhiệm vụ hằng ngày (TaskDefinitions), phát thông báo cập nhật luật chơi.
   - **Support Service (`services/Support/Support.Api`)**: Tiếp nhận phản hồi từ người chơi (Feedback tickets), hàng đợi xử lý cho Admin, thông báo tự động (Notifications) và thông báo chung (Announcements).
2. **Database-per-service & Isolation**:
   - Không có foreign key hay query chéo giữa các database (`user_db`, `game_db`, `support_db`, `multiplayer_db`). Các khóa liên kết liên service đều lưu dưới dạng tham chiếu ID chuỗi/UUID (`REF`).
   - Elo người chơi được quản lý và ghi nhận **duy nhất** tại User Service.
3. **Audit Log & Bắt buộc có lý do (Reason)**:
   - Mọi thao tác ghi của Admin đều bắt buộc phải cung cấp `reason`.
   - Mỗi thao tác được ghi vào bảng `audit_logs` của chính service đó cùng transaction nghiệp vụ (`actor_id`, `action`, `target_type`, `target_id`, `before`, `after`, `reason`, `created_at`).
4. **Giao tiếp qua Kafka Event & Transactional Outbox**:
   - Ghi dữ liệu nghiệp vụ và sự kiện `outbox_messages` trong **cùng một database transaction**.
   - Background worker đọc outbox đẩy lên Kafka topic `sudoku.events` với cấu hình an toàn `acks=all`, `enable.idempotence=true`.
   - Consumer xử lý idempotent dựa trên bảng `inbox_messages(message_id, consumer_group)`.

---

## 2. Danh sách RPC & REST API Admin

### 2.1. User Service (`sudoku.user.v1.UserService` - gRPC)

| RPC Method | Request Message | Ý nghĩa & Nghiệp vụ |
| :--- | :--- | :--- |
| `AdminListUsers` | `AdminListUsersRequest` | Phân trang, tìm kiếm theo username/email, lọc theo status (`ACTIVE`, `BANNED`, `DELETED`) và tier, sắp xếp theo Elo hoặc ngày tạo. |
| `AdminGetUser` | `AdminGetUserRequest` | Lấy chi tiết người dùng, 10 bản ghi lịch sử `elo_histories` gần nhất và audit log liên quan. |
| `AdminBanUser` | `AdminBanUserRequest` | Khóa tài khoản có thời hạn (`banned_until`) hoặc vĩnh viễn, ghi nhận `ban_reason`, phát sự kiện `UserUpdated(BANNED)` và `UserAdminAction`. |
| `AdminUnbanUser` | `AdminUnbanUserRequest` | Mở khóa tài khoản kèm `reason`, phát sự kiện `UserUpdated(ACTIVE)` và `UserAdminAction`. |
| `AdminSoftDeleteUser` | `AdminSoftDeleteUserRequest` | Xóa mềm tài khoản (`DELETED`) kèm `reason`, không cho phép xóa Admin cuối cùng. |
| `AdminAdjustElo` | `AdminAdjustEloRequest` | Cộng (`ADD`), trừ (`SUBTRACT`), hoặc đặt lại (`SET`) Elo thủ công kèm `reason`. Áp dụng công thức `new_elo = max(0, elo + delta)`, cập nhật tier tương ứng, ghi `elo_histories(source_type = ADMIN)` và phát sự kiện `UserAdminAction`. |
| `AdminGrantRole` | `AdminGrantRoleRequest` | Cấp vai trò `ADMIN` cho người dùng kèm `reason`, phát `UserAdminAction`. |
| `AdminRevokeRole` | `AdminRevokeRoleRequest` | Thu hồi vai trò `ADMIN`. Chặn tự thu quyền chính mình và chặn thu quyền Admin cuối cùng của hệ thống. |
| `AdminListAuditLogs` | `AdminListAuditLogsRequest` | Tra cứu nhật ký audit log của User Service, lọc theo actor, target hoặc khoảng thời gian. |

### 2.2. Game Service (`sudoku.game.v1.GameService` - gRPC)

| RPC Method | Request Message | Ý nghĩa & Nghiệp vụ |
| :--- | :--- | :--- |
| `ListGameModes` (Public) | `ListGameModesRequest` | Lấy danh sách biến thể đang hoạt động (`is_active = true`) phục vụ UI tạo ván chơi. |
| `AdminListGameModes` | `AdminListGameModesRequest` | Lấy tất cả biến thể (kể cả đang tắt) kèm audit log cho Admin. |
| `AdminUpdateGameMode` | `AdminUpdateGameModeRequest` | Bật/tắt biến thể (ví dụ Shuffle), cập nhật tên/mô tả kèm `reason`. Lưu audit log và snapshot version. |
| `AdminListLevelConfigs` | `AdminListLevelConfigsRequest` | Danh sách cấu hình các mức độ khó (`EASY`, `MEDIUM`, `HARD`, `EXPERT`). |
| `AdminUpdateLevel` | `AdminUpdateLevelRequest` | Chỉnh sửa số ô cho sẵn (min/max clues), thời gian tối đa, số lỗi tối đa, hệ số điểm và trạng thái bật/tắt kèm `reason`. |
| `AdminListTaskDefs` | `AdminListTaskDefsRequest` | Danh sách định nghĩa nhiệm vụ hằng ngày. |
| `AdminCreateTaskDef` | `AdminCreateTaskDefRequest` | Tạo nhiệm vụ mới (code, tên, mô tả, loại điều kiện, mục tiêu, EXP thưởng). |
| `AdminUpdateTaskDef` | `AdminUpdateTaskDefRequest` | Cập nhật cấu hình hoặc bật/tắt nhiệm vụ hằng ngày. |

> **Thông báo cập nhật luật chơi**: Nếu form Admin bật tùy chọn *"Thông báo cho người chơi"*, Game Service sẽ ghi sự kiện `GameRulesChanged` vào outbox để Support Service phát thông báo chung (Announcement).

### 2.3. Support Service (REST API / ASP.NET Core)

#### Dành cho Người chơi (`/api/v1/feedback` & `/api/v1/notifications`)
- `POST /api/v1/feedback`: Gửi yêu cầu hỗ trợ mới (`type`: `BUG`, `SUGGESTION`, `REPORT_PLAYER`, `OTHER`, `title`, `content`, tùy chọn `relatedMatchId`).
- `GET /api/v1/feedback`: Lấy danh sách phiếu hỗ trợ của chính mình (phân trang).
- `GET /api/v1/feedback/{id}`: Xem chi tiết phiếu và lịch sử trao đổi.
- `POST /api/v1/feedback/{id}/messages`: Gửi thêm tin nhắn phản hồi vào phiếu đang mở.
- `GET /api/v1/notifications`: Lấy danh sách thông báo cá nhân.
- `PUT /api/v1/notifications/{id}/read`: Đánh dấu thông báo đã đọc.

#### Dành cho Quản trị viên (`/api/v1/admin/feedback`)
- `GET /api/v1/admin/feedback`: Hàng đợi phản hồi, lọc theo `status` (`NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), `type`, từ khóa tìm kiếm.
- `GET /api/v1/admin/feedback/{id}`: Chi tiết phiếu phản hồi, hội thoại và liên kết điều hướng tới trận đấu hoặc tài khoản bị báo cáo.
- `POST /api/v1/admin/feedback/{id}/reply`: Phản hồi người dùng kèm nội dung. **Tự động tạo Notification cho chủ ticket ngay trong cùng transaction**.
- `PUT /api/v1/admin/feedback/{id}/status`: Chuyển trạng thái phiếu (`NEW` → `IN_PROGRESS` → `RESOLVED` / `CLOSED`). **Tự động tạo Notification cho chủ ticket ngay trong cùng transaction**.
- `PUT /api/v1/admin/feedback/{id}/assign`: Gán phiếu cho Admin phụ trách.
- `GET /api/v1/admin/feedback/audit-logs`: Danh sách audit log thao tác của Admin tại Support Service.

---

## 3. Lược đồ Cơ sở dữ liệu (Database Schema)

### 3.1. User Database (`user_db`)
- **`users`** (cập nhật):
  - `ban_reason` (`TEXT`): Lý do khóa tài khoản.
  - `banned_until` (`TIMESTAMPTZ`): Thời điểm hết hạn khóa (NULL nếu khóa vĩnh viễn hoặc đang ACTIVE).
  - `last_login_at` (`TIMESTAMPTZ`): Lần đăng nhập gần nhất.
- **`audit_logs`** (mới):
  - Cột: `id` (UUID), `actor_id` (VARCHAR), `action` (VARCHAR), `target_type` (VARCHAR), `target_id` (VARCHAR), `before` (JSONB), `after` (JSONB), `reason` (TEXT), `created_at` (TIMESTAMPTZ).
  - Index: `(created_at DESC)` và `(actor_id, created_at DESC)`.
- **`elo_histories`** (mới):
  - Cột: `id` (UUID), `user_id` (VARCHAR), `source_type` (VARCHAR: `SOLO`, `MULTI`, `ADMIN`), `source_id` (VARCHAR), `old_elo` (INT), `new_elo` (INT), `delta` (INT), `reason` (TEXT), `created_at` (TIMESTAMPTZ).
  - Index: `(user_id, created_at DESC)` và Unique `(user_id, source_type, source_id)`.
- **`outbox_messages`**: Lưu trữ sự kiện trước khi đẩy lên Kafka.

### 3.2. Game Database (`game_db`)
- **`game_modes`** (mới):
  - Cột: `code` (PK), `name`, `description`, `is_active` (BOOL), `version` (INT), `updated_at` (TIMESTAMPTZ).
  - Seed mặc định: `classic`, `shuffle`.
- **`levels`** (cập nhật):
  - Bổ sung: `score_multiplier` (FLOAT), `time_limit_seconds` (INT), `version` (INT), `updated_at` (TIMESTAMPTZ).
- **`task_definitions`** (mới):
  - Cột: `code` (PK), `name`, `description`, `condition_type`, `target_count`, `exp_reward`, `is_active`, `version`, `updated_at`.
- **`game_audit_logs`** (mới):
  - Cấu trúc tương tự User Audit Log, lưu vết các thay đổi về biến thể, độ khó và nhiệm vụ.

### 3.3. Support Database (`support_db`)
- **`feedback_tickets`** (mới):
  - Cột: `id` (UUID), `user_id` (VARCHAR REF), `type` (VARCHAR), `title` (VARCHAR), `status` (VARCHAR), `assigned_admin_id` (VARCHAR REF), `related_match_id` (VARCHAR REF), `created_at`, `updated_at`.
  - Index: `(user_id, created_at DESC)`, `(status, created_at)`.
- **`feedback_messages`** (mới):
  - Cột: `id` (UUID), `ticket_id` (FK cascade), `sender_id` (VARCHAR REF), `sender_role` (`USER` | `ADMIN`), `content` (TEXT), `created_at`.
- **`notifications`** (mới / mở rộng):
  - Cột: `id` (UUID), `user_id` (VARCHAR REF), `type` (VARCHAR), `title` (VARCHAR), `body` (TEXT), `ref_id` (VARCHAR), `is_read` (BOOL), `created_at`.
  - Unique Index: `(user_id, ref_id, type)`.
- **`player_refs`**: Lưu cache `user_id`, `display_name`, `status` để hiển thị tên người chơi mà không cần query chéo DB.
- **`support_audit_logs`**: Lưu nhật ký thao tác admin (gán ticket, chuyển trạng thái, trả lời).
- **`inbox_messages`**: Chống trùng lặp sự kiện Kafka (`message_id`, `consumer_group`, `processed_at`).

---

## 4. Sự kiện Kafka (`sudoku.events`)

| Event Type | Producer | Consumer | Payload chính | Hành vi xử lý |
| :--- | :--- | :--- | :--- | :--- |
| `user.updated.v1` | User | Multiplayer, Support | `user_id`, `status` (`BANNED`, `ACTIVE`, `DELETED`), `display_name` | Multiplayer hủy hàng chờ ghép trận nếu status là `BANNED`. Support cập nhật `player_refs`. |
| `user.admin-action.v1` | User | Support | `user_id`, `action` (`BANNED`, `UNBANNED`, `ELO_ADJUSTED`, `ROLE_CHANGED`), `reason`, `banned_until`, `elo_delta` | Support Service tự động tạo bản ghi `notifications` gửi tới người chơi bị tác động (idempotent theo `event_id`). |
| `game.rules-changed.v1` | Game | Support | `title`, `content`, `effective_at` | Support Service tự động tạo thông báo toàn hệ thống (`ANNOUNCEMENT`) hiển thị tại mục Notices. |

---

## 5. Cấu hình & Khởi chạy Hệ thống

### 5.1. File cấu hình `appsettings.json`
Đã được cấu hình đầy đủ ở cả 4 service với mật khẩu PostgreSQL đồng nhất `Password=12345`:
- `services/User/User.Api/appsettings.json`
- `services/Game/Game.Api/appsettings.json`
- `services/Support/Support.Api/appsettings.json`
- `services/Multiplayer/Multiplayer.Api/appsettings.json`

### 5.2. Chạy với Docker Compose
File `deploy/.env` và `deploy/docker-compose.yml` đã được cập nhật:
```bash
POSTGRES_PASSWORD=12345
```

Khởi chạy toàn bộ hạ tầng (Postgres, Kafka, Redis, Envoy Gateway, các Services):
```bash
cd deploy
docker compose up -d
```

### 5.3. Khởi chạy Frontend React
Cài đặt thư viện và chạy máy chủ phát triển:
```bash
cd clients
npm run dev
```

Truy cập:
- Trang chủ người chơi: `http://localhost:5173/`
- Gửi phản hồi / Góp ý: `http://localhost:5173/feedback`
- Admin Portal: `http://localhost:5173/admin` (hoặc `/admin/users`, `/admin/game-rules`, `/admin/feedback`). Được bảo vệ bởi guard `RequireAdmin` (yêu cầu JWT claim `role = ADMIN` hoặc tài khoản có email admin trong dev mode).

---

## 6. Hướng dẫn Thao tác Quản trị (Admin Runbook)

### 6.1. Quản lý Người dùng (`/admin/users`)
1. **Tìm kiếm & Lọc**: Nhập tên hoặc email vào ô tìm kiếm; lọc theo trạng thái (`Hoạt động`, `Bị khóa`, `Đã xóa`) hoặc theo thứ hạng (Hạng Đồng, Bạc, Vàng, Kim Cương...).
2. **Khóa tài khoản (Ban)**:
   - Nhấn nút **Khóa** trên hàng người dùng.
   - Nhập lý do (bắt buộc).
   - Chọn ngày giờ hết hạn (nếu để trống = khóa vĩnh viễn).
   - Hệ thống phát `user.updated.v1` (status BANNED) để kick khỏi trận/hàng chờ và gửi thông báo lý do khóa tới người chơi.
3. **Mở khóa (Unban)**: Nhấn **Mở khóa**, nhập lý do; trạng thái tài khoản chuyển về `ACTIVE`.
4. **Điều chỉnh Elo**:
   - Nhấn nút **Chỉnh Elo**.
   - Chọn hành động (`Cộng Elo`, `Trừ Elo`, hoặc `Đặt lại`).
   - Nhập số điểm và lý do thay đổi.
   - Elo và Tier được tính toán lại ngay lập tức, lưu vết vào `elo_histories` và tạo thông báo tới người chơi.
5. **Cấp / Thu quyền Admin**:
   - Nhấn **Cấp Admin** hoặc **Thu quyền Admin**.
   - Hệ thống tự động kiểm tra: Admin không thể tự tước quyền của chính mình và không thể tước quyền Admin cuối cùng của hệ thống.
6. **Xem Audit Log**: Chuyển sang tab **Nhật ký Admin** để xem chi tiết ai đã thao tác, thời gian, lý do, và dữ liệu trước/sau (before/after JSON).

### 6.2. Quản lý Luật chơi (`/admin/game-rules`)
1. **Bật / Tắt biến thể**:
   - Gạt nút trạng thái tại thẻ biến thể (Classic hoặc Shuffle).
   - Biến thể bị tắt sẽ không xuất hiện tại màn hình chọn ván chơi solo hoặc ghép trận multiplayer.
2. **Cấu hình độ khó Sudoku**:
   - Nhấn **Chỉnh sửa** tại cấp độ (Dễ, Trung bình, Khó, Chuyên gia).
   - Tùy chỉnh: Số ô mở sẵn (Clues min/max), thời gian tối đa, số lỗi tối đa cho phép, hệ số nhân điểm (Score Multiplier).
3. **Nhiệm vụ hằng ngày**:
   - Nhấn **+ Thêm nhiệm vụ mới** hoặc bật/tắt các nhiệm vụ hiện có.
   - Thiết lập số lần hoàn thành yêu cầu và điểm EXP thưởng.
4. **Phát thông báo toàn server**: Tích chọn *"Gửi thông báo cập nhật luật cho toàn bộ người chơi"*, nhập nội dung tóm tắt để tự động tạo một thông báo toàn hệ thống (Announcement).

### 6.3. Xử lý Phản hồi & Báo cáo (`/admin/feedback`)
1. **Tiếp nhận ticket**:
   - Danh sách ticket được hiển thị theo thứ tự thời gian, đánh dấu trực quan theo loại (`BUG`, `SUGGESTION`, `REPORT_PLAYER`, `OTHER`) và trạng thái.
2. **Xem chi tiết & Trả lời**:
   - Nhấp vào ticket để xem toàn bộ lịch sử trao đổi giữa người chơi và ban quản trị.
   - Nhập nội dung vào khung trả lời để phản hồi trực tiếp tới người chơi.
3. **Chuyển trạng thái & Gán quyền**:
   - Đổi trạng thái từ `Mới tiếp nhận` sang `Đang xử lý`, `Đã giải quyết` hoặc `Đã đóng`.
   - Bấm **Gán cho tôi** để nhận phụ trách xử lý ticket.
4. **Xử lý ticket Báo cáo người chơi (`REPORT_PLAYER`)**:
   - Nếu người chơi đính kèm mã trận đấu (`related_match_id`), UI admin hiển thị liên kết trực tiếp tới ván đấu.
   - Có nút điều hướng nhanh tới trang chi tiết người dùng bị tố cáo trong `/admin/users` để thực hiện khóa tài khoản nếu xác nhận vi phạm gian lận.

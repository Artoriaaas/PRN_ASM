# 🎮 KỊCH BẢN DEMO NỀN TẢNG SUDOKU ONLINE (DEMO WALKTHROUGH GUIDE)
**Dự án**: Sudoku Online Platform (PRN_ASM)  
**Kiến trúc**: Microservices (.NET 8 gRPC, SignalR, Kafka, Redis, PostgreSQL, Envoy Gateway, React 19 + TypeScript)  
**Tài liệu dành cho**: Thuyết trình đồ án, Đánh giá tính năng & Kiểm thử luồng nghiệp vụ end-to-end.

---

## 🧭 MỤC LỤC KỊCH BẢN DEMO
1. [Chuẩn bị môi trường & Tài khoản kiểm thử](#1-chuẩn-bị-môi-trường--tài-khoản-kiểm-thử)
2. [FLOW 1: Chơi Đơn (Solo Gameplay Flow)](#2-flow-1-chơi-đơn-solo-gameplay-flow)
3. [FLOW 2: Đấu Nhiều Người Thời Gian Thực (Multiplayer 1v1 Flow)](#3-flow-2-đấu-nhiều-người-thời-gian-thực-multiplayer-1v1-flow)
4. [FLOW 3: Phản Hồi Người Dùng & Quản Trị Duyệt (User Feedback -> Admin Review Flow)](#4-flow-3-phản-hồi-người-dùng--quản-trị-duyệt-user-feedback---admin-review-flow)
5. [Tóm tắt công nghệ trình bày (Key Technical Talking Points)](#5-tóm-tắt-công-nghệ-trình-bày-key-technical-talking-points)

---

## 1. CHUẨN BỊ MÔI TRƯỜNG & TÀI KHOẢN KIỂM THỬ

### 1.1. Khởi động hệ thống
Đảm bảo các container Docker của dự án đã sẵn sàng:
```bash
docker compose -f deploy/docker-compose.yml ps
```
* **Frontend Web**: Truy cập tại `http://localhost:5173` (hoặc port của Vite dev server `http://localhost:5174`).
* **Envoy Gateway**: `http://localhost:18080` (hoặc `http://localhost:8080`).

### 1.2. Danh sách tài khoản chuẩn bị demo
| Loại tài khoản | Email | Mật khẩu | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Admin** | `sudokuadmin@gmail.com` | `Admin@123` | Quản trị viên: duyệt Feedback, quản lý User, cấu hình Luật chơi |
| **Player A** | Tài khoản Google / Email 1 | *Mật khẩu của bạn* | Người chơi 1: test Solo, tạo phòng Multiplayer, gửi Feedback |
| **Player B** | Tài khoản Google / Email 2 | *Mật khẩu của bạn* | Người chơi 2 (mở tab ẩn danh): test thi đấu 1v1 đối kháng |

---

## 2. FLOW 1: CHƠI ĐƠN (SOLO GAMEPLAY FLOW)

> **Mục tiêu**: Demo trải nghiệm giải đố cá nhân, kiểm thử thuật toán sinh đề Sudoku, chế độ Ghi chú (Notes), cơ chế tính sai trừ mạng, và tính năng **Gợi ý logic thông minh (Smart Hint)**.

```
[Trang chủ /home] 
       │
       ▼ (Bấm "Chơi ngay" Solo)
[Cấu hình ván đấu /solo/new] ──► Chọn Bố cục (Standard/Shuffle) & Độ khó (Easy/Medium/Hard/Expert)
       │
       ▼ (Bấm "Bắt đầu chơi")
[Bàn cờ Sudoku /solo/:sessionId] ──► Chơi game, Nhập số, Điền Notes (N), Dùng Smart Hint (H)
       │
       ▼ (Hoàn thành 81 ô đúng)
[Kết quả ván đấu /solo/:sessionId/result] ──► Thống kê thời gian, Tỷ lệ chính xác, Nhận XP
```

### Các bước thực hiện chi tiết:

1. **Bước 1: Vào trang cấu hình chơi đơn**
   * Đăng nhập với tư cách người chơi thông thường.
   * Tại **Trang chủ (`/home`)**, tại thẻ màu xanh **"Solo - Độc lập"**, bấm nút **`Chơi ngay →`**.
   * Hệ thống chuyển đến màn hình **Cấu hình ván đấu (`/solo/new`)**.

2. **Bước 2: Tùy chỉnh ván cờ**
   * **Bố cục bàn cờ (Layout)**:
     * Chọn `Standard`: Bàn cờ Sudoku 9x9 với 9 khối 3x3 truyền thống.
     * Hoặc chọn `Shuffle / Irregular`: Bàn cờ Sudoku biến thể với các khối hình tự do đa sắc màu.
   * **Cấp độ (Level)**: Chọn một trong 4 độ khó: `Dễ`, `Trung bình`, `Khó`, hoặc `Chuyên gia`.
   * Bấm nút **`Bắt đầu chơi`**.
   * *(Hậu trường kỹ thuật)*: Frontend gọi gRPC `GameService.StartGameSession` qua Envoy Gateway. Backend cấp phát bàn cờ từ PostgreSQL (`game_db.puzzles`), khởi tạo session trong `game_sessions` và trả về `sessionId`.

3. **Bước 3: Trải nghiệm tương tác trên bàn cờ (`/solo/:sessionId`)**
   * **Đồng hồ bấm giờ**: Hiển thị thời gian giải thực tế đang chạy.
   * **Chọn ô & Điền số**:
     * Dùng chuột click ô trống hoặc dùng 4 phím mũi tên `↑ ↓ ← →` để di chuyển.
     * Nhấn số `1 - 9` trên bàn phím (hoặc bàn phím số ảo bên dưới).
   * **Chế độ Ghi chú (Notes Mode)**:
     * Nhấn phím `N` (hoặc bấm nút **"Ghi chú"**). Khi bật, các số nhập vào sẽ hiển thị dưới dạng chữ nhỏ (ứng viên logic).
     * Khi điền một số chính xác, hệ thống tự động xóa các ghi chú trùng lặp cùng hàng/cột/khối.
   * **Cơ chế tính Mạng (Mistakes)**:
     * Thử cố tình điền một số sai vào ô.
     * Ô sẽ nhấp nháy đỏ báo lỗi, số tim (mạng) giảm đi 1 (VD: từ `3/3` còn `2/3`).
   * **TÍNH NĂNG ĐẶC BIỆT — Gợi ý thông minh (Smart Hint)**:
     * Chọn một ô khó, bấm nút **`💡 Gợi ý`** (hoặc nhấn phím `H`).
     * Hệ thống **không** điền bừa số cho người chơi, mà mở popup giải thích kỹ thuật phân tích logic (VD: *Naked Single, Hidden Single, Pointing Pairs, X-Wing...*) giúp người chơi học kỹ thuật giải chuyên sâu.

4. **Bước 4: Hoàn thành ván đấu & Màn hình Kết quả (`/solo/:sessionId/result`)**
   * Khi ô số cuối cùng được điền chính xác, ván đấu tự động kết thúc.
   * Frontend chuyển hướng sang màn hình **Kết quả ván đấu**.
   * Điểm nổi bật để thuyết minh:
     * **Thời gian hoàn thành**: Số phút, giây hoàn tất.
     * **Độ chính xác (Accuracy)**: Dựa trên số nước đi đúng / tổng số nước đi.
     * **Điểm XP và Cúp cộng thêm**: Cập nhật tiến trình thăng cấp Level người chơi.
     * Bấm **`Chơi ván mới`** hoặc **`Về trang chủ`**.

---

## 3. FLOW 2: ĐẤU NHIỀU NGƯỜI THỜI GIAN THỰC (MULTIPLAYER 1V1 FLOW)

> **Mục tiêu**: Demo khả năng đồng bộ thời gian thực qua **SignalR WebSockets**, kiến trúc giao tiếp 2 chiều giữa 2 người chơi thật, cơ chế ghép cặp tự động (Matchmaking) và phòng riêng (Custom Room).

```
  [Player A - Tab chính]                    [Player B - Tab ẩn danh]
           │                                           │
           ▼                                           ▼
[Vào sảnh đấu /play]                         [Vào sảnh đấu /play]
           │                                           │
           ├──────────── THỂ THỨC RACE / DUEL ─────────┤
           ▼                                           ▼
[Hàng đợi ghép trận /play/queue]             [Hàng đợi ghép trận /play/queue]
           │                                           │
           └─────────► Ghép đôi tự động qua SignalR ◄──┘
                                   │
                                   ▼
              [Vào phòng đấu chung /match/:matchId]
               ├─ Race: Đua tốc độ (giải song song)
               └─ Duel: Đấu luân phiên (chung bàn cờ, 15s/lượt)
                                   │
                                   ▼
              [Màn hình kết quả /match/:matchId/result]
               └─ Cộng/Trừ điểm Elo Rating trực tiếp
```

### Các bước thực hiện chi tiết (Chuẩn bị 2 Tab):
* **Tab 1 (Trình duyệt thường)**: Đăng nhập Người chơi A.
* **Tab 2 (Cửa sổ Ẩn danh / Incognito)**: Đăng nhập Người chơi B.

---

### Kịch bản 2A: Ghép trận nhanh tự động (Quick Matchmaking)

1. **Vào sảnh chờ**:
   * Cả Player A và Player B cùng vào menu **"Đấu trận"** trên Navbar (URL: `/play`).
   * Giao diện hiển thị chỉ số Elo của từng chế độ: **Race Rating** và **Duel Rating**.
2. **Chọn chế độ thi đấu**:
   * *Lựa chọn 1: Chế độ Race (Đua tốc độ)*: Cả 2 nhận cùng 1 đề Sudoku, ai giải xong trước sẽ thắng.
   * *Lựa chọn 2: Chế độ Duel (Đấu trí luân phiên)*: Cả 2 thi đấu chung trên duy nhất 1 bàn cờ, mỗi người có 15 giây cho lượt đi của mình.
   * Cả Player A và Player B cùng bấm **`Tìm trận nhanh`** ở cùng một thể thức (VD: Race).
3. **Quá trình ghép trận (`/play/queue`)**:
   * Cả 2 màn hình chuyển sang giao diện radar quét tìm đối thủ.
   * SignalR Hub `MatchHub` tại `Multiplayer.Api` ghi nhận 2 connection, so khớp khoảng cách rating Elo.
   * Sau 1-2 giây: Hiệu ứng **"Đã tìm thấy trận đấu!"** vang lên, cả 2 tab được điều hướng cùng lúc vào `/match/:matchId`.

---

### Kịch bản 2B: Tạo phòng bạn bè (Custom Room với Mã mời)

1. Tại Tab của Player A, bấm nút **`Tạo phòng bạn bè`**.
2. Một popup mở ra: Chọn thể thức (*Race* hoặc *Duel*), chọn cấp độ (*Dễ/Trung bình/Khó*).
3. Bấm **`Tạo phòng`** -> Hệ thống sinh ra **Mã phòng 6 ký tự** (Ví dụ: `SDK888`).
4. Tại Tab của Player B, bấm **`Vào phòng bạn bè`**, nhập mã `SDK888` và bấm **`Tham gia`**.
5. Cả 2 người chơi lập tức được đưa vào trận đấu mà không cần qua hàng đợi công cộng.

---

### Tương tác trực tiếp trong trận đấu:
* **Nếu chơi Chế độ Race**:
  * Mỗi người có một bàn cờ riêng ở màn hình của mình.
  * Nhìn sang góc bên phải: Có thanh **Tiến độ đối thủ (Opponent Progress Bar)** hiển thị phần trăm hoàn thành của đối phương theo thời gian thực (real-time websocket).
  * Thử điền một ô sai: Người chơi bị phạt đóng băng 10 giây kèm hiệu ứng rung màn hình.
  * Người chơi nào điền đúng toàn bộ 81 ô đầu tiên sẽ kết thúc trận đấu.
* **Nếu chơi Chế độ Duel**:
  * Cả hai cùng nhìn vào **1 bàn cờ chung**.
  * Phía trên có đồng hồ đếm ngược **15 giây mỗi lượt** và hiển thị ai đang tới lượt (`Lượt của bạn` / `Lượt của đối thủ`).
  * Khi Player A điền đúng số vào ô: Ô đó lập tức đổi màu của Player A, cộng +10 điểm, lượt chuyển sang Player B.
  * Nếu Player B điền sai: Bị trừ -5 điểm, mất lượt và số đúng bị lộ cho đối thủ.
* **Kết thúc trận đấu & Cập nhật Xếp hạng (`/match/:matchId/result`)**:
  * Màn hình công bố người chiến thắng (`VICTORY` / `DEFEAT`).
  * Điểm Elo Rating của người thắng tăng lên (VD: `+16 Elo`), người thua bị giảm (VD: `-14 Elo`).
  * Sự kiện trận đấu được đẩy lên Apache Kafka topic `sudoku.events`, User Service tiêu thụ event và lưu lịch sử đấu vào cơ sở dữ liệu `user_db`.

---

## 4. FLOW 3: PHẢN HỒI NGƯỜI DÙNG & QUẢN TRỊ DUYỆT (USER FEEDBACK -> ADMIN REVIEW FLOW)

> **Mục tiêu**: Demo vòng đời phản hồi hỗ trợ khách hàng khép kín (End-to-End Feedback Lifecycle): từ khi người chơi gửi khiếu nại/góp ý đến khi Admin tiếp nhận, đổi trạng thái và chat phản hồi người dùng.

```
       [NGƯỜI DÙNG - /feedback]                          [ADMIN - /admin/feedback]
                  │                                                  │
                  ▼                                                  │
    Bấm "+ Gửi phản hồi mới"                                         │
    (Điền loại: BUG, Tiêu đề, Nội dung)                              │
                  │                                                  │
                  ▼ (POST /api/v1/feedback)                          │
    Ticket xuất hiện trong danh sách                                 │
    (Trạng thái: NEW)                                                │
                  │                                                  │
                  └────────────── Lưu vào support_db ───────────────►│
                                                                     ▼
                                                      Admin thấy Ticket trong Hàng đợi
                                                                     │
                                                                     ▼
                                                      Admin bấm xem chi tiết Ticket
                                                      ├─ Đổi trạng thái: IN_PROGRESS / RESOLVED
                                                      └─ Gửi tin nhắn trả lời (Reply)
                                                                     │
                  ┌────────────── Đồng bộ DB & Event ────────────────┘
                  ▼
    Người dùng tải lại /feedback
    ├─ Thấy trạng thái cập nhật (RESOLVED)
    └─ Đọc nội dung chat trả lời của Admin
```

### Các bước thực hiện chi tiết:

### Bước 1: Người dùng gửi góp ý (User Portal)
1. Đăng nhập bằng tài khoản người chơi thường.
2. Trên thanh điều hướng (Navbar trên cùng), click vào mục **`Góp ý`** (URL: `http://localhost:5173/feedback`).
3. Giao diện quản lý phản hồi cá nhân mở ra. Bấm nút **`+ Gửi phản hồi mới`**.
4. Điền thông tin vào Modal popup:
   * **Thể loại**: Chọn `Báo lỗi (BUG)` hoặc `Góp ý (SUGGESTION)`.
   * **Tiêu đề**: Nhập *"Đề xuất thêm chế độ Dark Mode cho ban đêm"*.
   * **Nội dung**: Nhập *"Tôi thường chơi Sudoku vào buổi tối, rất mong Admin bổ sung giao diện nền tối để bảo vệ mắt. Cảm ơn đội ngũ phát triển!"*.
   * **Mã trận đấu** *(tùy chọn)*: Để trống hoặc điền mã ván cờ nếu là báo lỗi.
5. Bấm nút **`Gửi phản hồi`**.
6. **Kết quả**:
   * Thông báo thành công hiển thị (`Toast`).
   * Ticket xuất hiện ngay ở danh sách bên trái với nhãn badge màu vàng **`NEW`**.

---

### Bước 2: Admin kiểm tra, duyệt và phản hồi (Admin Portal)
1. Bấm nút **`Đăng xuất`** ở góc phải Header để đăng xuất tài khoản người dùng.
2. Tại màn hình Đăng nhập (`/auth`), nhập thông tin tài khoản Quản trị viên:
   * **Email**: `sudokuadmin@gmail.com`
   * **Mật khẩu**: `Admin@123`
   * Bấm **`Đăng nhập`**.
3. **Chuyển hướng thông minh**: Hệ thống phát hiện tài khoản mang quyền `admin` và tự động đưa thẳng vào **Admin Portal** (`/admin/users`) mà không qua giao diện người chơi.
4. Trên thanh Menu bên trái của Admin, click chọn mục **`Feedback`** (URL: `/admin/feedback`).
5. **Xem và xử lý Ticket**:
   * Tại cột bên trái **"Hàng đợi Feedback & Báo cáo"**, ticket *"Đề xuất thêm chế độ Dark Mode cho ban đêm"* vừa gửi xuất hiện ở vị trí đầu tiên.
   * Click vào ticket để mở chi tiết bên phải:
     * Hiển thị đầy đủ: Tiêu đề, Mã ticket, UID người gửi, Thể loại, Trạng thái hiện tại (`NEW`).
     * Toàn bộ nội dung thư của người dùng.
6. **Thay đổi trạng thái Ticket**:
   * Tại ô *Trạng thái ticket*, chọn đổi từ `NEW` sang **`IN_PROGRESS`** (Đang xử lý) hoặc **`RESOLVED`** (Đã giải quyết).
   * Nhập lý do audit: *"Admin đã tiếp nhận và chuyển giao task cho nhóm thiết kế UI"*.
   * Bấm **`Lưu trạng thái`** -> Badge trạng thái lập tức chuyển sang màu xanh lá (`RESOLVED`).
7. **Gửi tin nhắn phản hồi trực tiếp cho người chơi**:
   * Tại khung *Gửi phản hồi cho người chơi*, nhập:
     > *"Chào bạn, cảm ơn bạn đã gửi đóng góp rất thiết thực! Đội ngũ phát triển đã đưa tính năng Dark Mode vào lộ trình và sẽ ra mắt trong bản cập nhật tuần tới nhé."*
   * Bấm nút **`Gửi phản hồi`**.
   * Tin nhắn của Admin xuất hiện ngay trong chuỗi tin nhắn hội thoại của ticket.

---

### Bước 3: Người dùng xác nhận kết quả (Verification)
1. Trên sidebar Admin, bấm nút **`🚪 Đăng xuất`** ở góc dưới cùng.
2. Đăng nhập lại vào tài khoản Người chơi ban đầu.
3. Vào lại trang **`Góp ý`** (`/feedback`):
   * Ticket *"Đề xuất thêm chế độ Dark Mode cho ban đêm"* đã đổi trạng thái thành **`RESOLVED`**.
   * Bấm vào xem ticket: Đoạn chat phản hồi của Admin hiển thị chi tiết, rõ ràng và minh bạch.

---

## 5. TÓM TẮT CÔNG NGHỆ TRÌNH BÀY (KEY TECHNICAL TALKING POINTS)

Khi trình bày với ban giám khảo hoặc người chấm đồ án, bạn có thể nhấn mạnh các điểm mạnh kỹ thuật sau:

1. **Kiến trúc Contract-First & Microservices**:
   * Các microservices (`Game`, `User`, `Support`, `Multiplayer`) tách biệt hoàn toàn cơ sở dữ liệu (Database-per-service), giao tiếp liên service qua gRPC và Protobuf (`proto/sudoku/**/*.proto`).
2. **Cơ chế Event-Driven & Outbox Pattern**:
   * Khi kết thúc trận đấu, `Multiplayer.Api` ghi event vào bảng `outbox_messages` trong cùng một Database Transaction. Background worker sẽ publish lên **Apache Kafka** topic `sudoku.events` đảm bảo tính toàn vẹn (At-least-once delivery) và bảo đảm tính Idempotent ở phía `User.Api`.
3. **Giao tiếp Real-time hiệu năng cao với SignalR**:
   * Không chạm DB PostgreSQL trong hot path mỗi nước đi của bàn cờ để đạt độ trễ thấp nhất (< 20ms); trạng thái ván đấu multiplayer được lưu tạm thời trên RAM / Redis Cache.
4. **Bảo mật phân quyền JWT chặt chẽ**:
   * Triển khai gRPC interceptor và REST Authorization Policy `[Authorize(Policy = "Admin")]`. Claim `role=admin` được giải mã từ token, bảo đảm người dùng thường không thể truy cập trái phép API của quản trị viên.
5. **Giao diện hiện đại & Thân thiện (UX/UI)**:
   * React 19 + TypeScript, sử dụng ConnectRPC Web Transport.
   * Giao diện Admin Portal tối ưu hiển thị dạng danh sách bảng (Table List) chống tràn màn hình, hỗ trợ responsive hoàn hảo trên mọi độ phân giải.

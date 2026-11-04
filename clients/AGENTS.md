# Frontend Rules (`web/`)

File này tự động nạp khi làm việc trong `web/**`. Kế thừa luật gốc từ `/AGENTS.md`.

## Stack & Quy ước Thư mục (`web/src/`)
- React 19 · TypeScript · Vite 8 · `@bufbuild/protobuf` v2 · `@connectrpc/connect` & `connect-web` v2 · `@microsoft/signalr` · Firebase v13 · `oxlint`.
- **`src/gen/`**: Code sinh tự động từ `../proto` qua lệnh `npm run gen`. **Tuyệt đối không sửa tay.**
  - Lưu ý `@bufbuild/protobuf` v2: Service descriptor (`UserService`, `GameService`, `MultiplayerService`, `SupportService`) được export trực tiếp từ file `*_pb.ts` (vd `../gen/sudoku/user/v1/user_pb`). **Không tồn tại** file `*_connect.ts`.
- **`src/api/`**: Khởi tạo ConnectRPC client qua `createGrpcWebTransport` trỏ tới **Envoy Gateway** (`import.meta.env.VITE_API_URL ?? "http://localhost:8080"` — không bao giờ gọi thẳng port `5101..5105` của backend), gắn interceptor `Authorization: Bearer <idToken>`, kèm cache 2 tầng (RAM `Map` + `sessionStorage`).
- **`src/auth/`**: Khởi tạo Firebase Auth & quản lý ID Token.
- **`src/realtime/`**: Quản lý kết nối SignalR tới `/hubs/match` qua Envoy.

## Luật Hiệu năng & UX Bắt buộc (chi tiết: `docs/OPTIMIZATION.md` §3)
1. **Cô lập `<GameTimer />` khỏi `<SudokuBoard />`**: Không đặt state đếm giây ở component cha chứa bàn cờ để tránh ép 81 `<SudokuCell />` re-render mỗi giây.
2. **Biểu diễn bàn cờ 81 ô phẳng & Bitmask ghi nháp**:
   - Dùng mảng phẳng 81 phần tử (`Uint8Array` / `number[]`), không dùng `number[][]`.
   - Ghi nháp (pencil marks 1–9) dùng số nguyên bitmask 9-bit (`0..511`, toggle bằng `mask ^ (1 << (n - 1))`).
   - Bọc `<SudokuCell />` bằng `React.memo` với toàn bộ props kiểu nguyên thủy (`value`, `notesMask`, `isSelected`, `isHighlighted`, `isConflict`).
3. **0ms Optimistic UI & Chống Double-Submit**:
   - Thao tác điền ô/ghi nháp cập nhật state ngay lập tức ở `0ms`, gửi SignalR ở nền (không khóa bàn cờ chờ server ack).
   - Nút hành động (`Tìm trận`, `Nộp bài`, `Lưu hồ sơ`) bắt buộc có khóa `isSubmitting` / `useActionState`.
   - Sau khi mutate (`UpdateProfile`, `SubmitResult`), cập nhật thẳng state/cache từ response trả về, không gọi re-fetch thừa.
4. **Cache, Deduplication & Hủy Request**:
   - Dữ liệu đọc lặp lại (`Profile`, `Rules`, `Tutorials`, `Notices`, `Rankings`) khởi tạo đồng bộ từ `getCachedSync` (tránh nháy trắng khi chuyển trang) và gộp request trùng bằng `fetchDeduped`.
   - Mọi `useEffect` gọi ConnectRPC phải truyền `{ signal: controller.signal }` (`AbortController`) và `abort()` khi cleanup.
5. **Vòng đời SignalR & Tài nguyên**:
   - Dùng 1 connection cho phiên đấu với `.withAutomaticReconnect([0, 1000, 2000, 5000])`, gọi sync lại state phòng trong `onreconnected`, và gỡ listener `connection.off(...)` khi unmount.
   - Các tab phụ (`Tutorials`, `MatchHistory`, `Leaderboard`) dùng `React.lazy`. Ảnh avatar nén trên `<canvas>` (`<= 256x256` WebP) trước khi upload và gọi `URL.revokeObjectURL`.

## Kiểm tra trước khi hoàn tất
- Nếu `.proto` thay đổi: `npm run gen`
- Kiểm tra tĩnh & build: `npm run lint` và `npm run build`

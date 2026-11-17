# PRN ASM — Sudoku Online | Bộ slide 18 tờ (có editor)

Bộ trình chiếu cho **PRN232 · Final Assignment**, nội dung bám theo các mục của đề, minh hoạ bằng dự án Sudoku Online (`github.com/Artoriaaas/PRN_ASM`). Có container diagram C4 và ERD riêng cho phần kiến trúc.

## Cách dùng nhanh

1. Mở `index.html` bằng Chrome hoặc Microsoft Edge (hoặc bấm `start-windows.bat` trên Windows).
2. Nhấn **✎ Chỉnh sửa** ở phía trên bên phải để mở chế độ biên tập.
3. Nhấp vào chữ để sửa; bảng bên phải đổi font, cỡ chữ, màu, in đậm, căn giữa. Dùng các nút thêm **hộp chữ / ảnh / diagram**, kéo thả và kéo góc để đổi kích thước.
4. Nhấn **Lưu trên máy** để lưu trên trình duyệt hiện tại; **Xuất HTML** để xuất bản mới chứa toàn bộ thay đổi; **Xuất JSON** để gửi bản dự án cho thành viên khác và **Nhập JSON** để cập nhật nội dung.

## Phím tắt (chế độ trình chiếu)

| Phím | Tác dụng |
| :--- | :--- |
| `←` `→` / `Space` / cuộn chuột | Chuyển slide trước / sau |
| `Home` `End` | Về slide đầu / cuối |
| `D` | Đổi bảng màu: giấy → rêu → chàm |
| `N` | Bật / tắt dải ghi chú thuyết trình |
| `O` | Mở bảng tổng quan 18 slide |
| `?` hoặc `H` | Mở bảng trợ giúp phím tắt |
| `F` hoặc `⤢` | Toàn màn hình |
| `Esc` | Đóng lớp phủ / thoát chỉnh sửa |

Trong lúc đang gõ chữ hoặc đang mở bảng chỉnh sửa, phím tắt trình chiếu tự tạm khoá để không chen vào nội dung.

## Ngôn ngữ thiết kế

Bản này dựng lại theo ngôn ngữ trình bày của bộ slide MLN122: nền giấy kẻ ô, mực cobalt, nhấn cam và xanh ngọc, nhãn kỹ thuật bằng chữ mono, khung hình có nhãn `HÌNH n` và chú thích, thanh tiến trình dạng "sợi chỉ" chấm tròn ở đáy.

- **Sân khấu** 1600×900, tự co giãn theo cửa sổ (không vỡ layout khi chiếu).
- **Font nhúng cục bộ** trong `fonts/` (SIL OFL): Bricolage Grotesque (tiêu đề), Be Vietnam Pro (nội dung), IBM Plex Mono (nhãn kỹ thuật), Newsreader (trích dẫn). Không cần mạng khi trình chiếu.
- **Bảng màu** khai báo một lần trong `src/tokens.css.part`; ba theme `giay` / `reu` / `cham` đổi bằng phím `D`.

## Cấu trúc thư mục

| Đường dẫn | Vai trò |
| :--- | :--- |
| `index.html` | **File thành phẩm** — slide + CSS + React runtime + editor nhúng, mở là chạy. File này được sinh tự động, đừng sửa tay. |
| `src/` | Nguồn rời để dựng `index.html` (CSS, slide, editor). |
| `src/tokens.css.part` | `@font-face` + biến màu, ba theme. |
| `src/deck.css.part` | Hệ thống thiết kế dùng chung: khung, chữ, `.fig`, `.strip`, `.thread`, `.foot`, `.note-band`, modal. |
| `src/prn.css.part` | Layout riêng từng slide. |
| `src/editor.css.part` | Giao diện bảng chỉnh sửa (giữ nguyên id cũ). |
| `src/slides.js.part` | 18 slide React, dữ liệu (`MEMBERS`, `DELIV`, `COMPOSE`, `MATRIX`, `ERD`, `TOC`, `WEIGHTS`, `NOTES`), điều hướng, phím tắt. |
| `src/editor.js.part` | Mã editor (sửa chữ, chèn ảnh/diagram, lưu, xuất/nhập). |
| `src/react-vendor.part` | React 16 + ReactDOM nhúng sẵn. |
| `scripts/build.py` | Ghép các mảnh thành `index.html` và kiểm tra. |
| `fonts/` | 4 họ font + giấy phép. |
| `original-react/` | Bản React cũ (trước khi đổi thiết kế) — chỉ để tham khảo. |
| `.github/workflows/deploy.yml` | CI deploy tĩnh lên GitHub Pages. |

## Dựng lại `index.html`

Sau khi sửa bất kỳ file nào trong `src/`:

```bash
python scripts/build.py          # dựng lại index.html
python scripts/build.py --check  # chỉ kiểm tra, không ghi file
```

`build.py` sẽ:

- ghép CSS + runtime + slide + `#prn-baked-state` + editor theo đúng thứ tự;
- kiểm tra đủ **18 slide / 18 tiêu đề / 18 ghi chú**, cặp ngoặc CSS cân, thẻ `<script>` cân;
- chặn mã màu hex viết ngoài `tokens.css.part`;
- chạy `node --check` trên `slides.js.part` nếu máy có Node.

Nếu đổi số slide, phải sửa đồng thời: `TOTAL` trong `slides.js.part`, `COUNT` + `#prn-baked-state` (18 phần tử) trong editor, và hai chỗ kẹp chỉ số `0..17`.

## Nội dung 18 slide

| # | Slide | Mục trong đề |
| :--- | :--- | :--- |
| 01 | Bìa | Giới thiệu nhóm, học phần |
| 02 | Mục lục · bản đồ bài trình bày | Giới thiệu nội dung + thang điểm |
| 03 | Mục tiêu & phạm vi | Objective |
| 04 | Kiến trúc tổng thể (C4 container) | Kiến trúc |
| 05 | Kiến trúc tầng & database | Thành phần, database-per-service |
| 06 | Sơ đồ thực thể (ERD) | CSDL quan hệ, mô hình dữ liệu |
| 07 | REST API (Support) | REST API |
| 08 | Background job | Background job |
| 09 | Kafka & Outbox–Inbox | Message broker |
| 10 | gRPC contract-first | gRPC service |
| 11 | Xác thực JWT | Technical requirements |
| 12 | Luồng solo end-to-end | Workflow |
| 13 | Multiplayer realtime | Hot path |
| 14 | Deploy bằng Docker Compose | Deployment |
| 15 | Mười hai yêu cầu kỹ thuật | Technical requirements |
| 16 | Sáu sản phẩm phải nộp | Deliverables |
| 17 | Ba quyết định thiết kế | Notes / bài học |
| 18 | Kết & Q&A | Kết |

## Gửi cho bạn bè

Gửi cả thư mục này, hoặc chỉ gửi `index.html` đã xuất từ editor (file đó đã chứa thay đổi). Người nhận mở bằng Chrome/Edge.

**Lưu ý:** thay đổi được lưu vào `localStorage` của từng trình duyệt, **không** tự đồng bộ giữa các máy. Muốn phối hợp thì mỗi người xuất JSON/HTML rồi gửi lại người tổng hợp.

## Đưa lên GitHub Pages

1. Tạo repository (ví dụ `prn-asm-slides`) và upload toàn bộ thư mục này, `index.html` nằm ở root.
2. Vào **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow `.github/workflows/deploy.yml` có sẵn sẽ tự xuất bản tại `https://USERNAME.github.io/prn-asm-slides/`.
4. Chỉnh sửa trên web chỉ lưu ở máy người đó. Muốn cập nhật trang chung: xuất HTML mới rồi commit đè `index.html`.

## Giới hạn

- Chữ trong slide sửa được bằng editor; hoạ tiết layout (khung hình, sợi chỉ tiến trình, lưới) là CSS nên không kéo thả.
- Toạ độ chỉnh sửa lưu theo đường dẫn DOM, nên nếu đổi cấu trúc slide thì các chỉnh sửa đã lưu cho slide đó sẽ không khớp nữa — dựng lại từ `src/` là bản gốc sạch.
- Khuyến nghị Chrome hoặc Edge trên desktop; khi trình chiếu nên bật toàn màn hình (`F`).

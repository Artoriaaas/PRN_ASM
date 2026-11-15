# PRN ASM — Sudoku Online | Slide Editor (18 slide)

## Cách dùng nhanh

1. Giải nén ZIP. Mở `index.html` bằng Chrome hoặc Microsoft Edge (hoặc bấm `start-windows.bat` trên Windows).
2. Nhấn nút **Chỉnh sửa** ở phía trên bên phải để mở chế độ biên tập.
3. Nhấp vào chữ để sửa; dùng bảng thuộc tính thay font, màu và cỡ chữ. Dùng các nút thêm văn bản / ảnh / diagram, kéo thả đối tượng.
4. Nhấn **Lưu trên máy** để lưu trên trình duyệt hiện tại; nhấn **Xuất HTML** để xuất bản mới chứa tất cả thay đổi; **Xuất JSON** để gửi bản dự án cho thành viên khác và **Nhập JSON** để cập nhật nội dung.
5. Chuyển slide bằng các nút điều hướng hoặc phím mũi tên ở chế độ trình chiếu.

## Gửi cho bạn bè

Gửi cả file ZIP này hoặc gửi file HTML được xuất từ trong Editor. Người nhận mở file HTML bằng Chrome/Edge.

**Lưu ý quan trọng:** Phiên bản này lưu thay đổi vào `localStorage` trên từng trình duyệt. Nó **không** có tính năng nhiều người cùng sửa và tự đồng bộ qua mạng. Để phối hợp, mỗi người xuất JSON/HTML rồi gửi lại người tổng hợp. Không có kết nối Supabase hoặc đăng nhập trong gói này.

## Đưa lên GitHub Pages (không cần cài Node.js)

1. Tạo repository mới có tên `prn-asm-slides` trên GitHub.
2. Upload toàn bộ nội dung thư mục này lên nhánh `main` của repository (đảm bảo `index.html` nằm ở root).
3. Vào **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Workflow `.github/workflows/deploy.yml` có sẵn sẽ tự xuất bản. Đường dẫn là `https://USERNAME.github.io/prn-asm-slides/`.
5. Lưu ý chỉnh sửa trên web và bấm 'Lưu trên máy' chỉ lưu vào máy người đó, **không cập nhật trang GitHub Pages**. Muốn cập nhật trang chung, xuất HTML mới, commit đè `index.html` lên GitHub để deploy lại.

## Mã nguồn

- `index.html` — file editor độc lập, gồm toàn bộ slide, CSS, JS, React runtime nhúng; dùng ngay.
- `editor-source/editor.js`, `editor-source/editor.css` — mã biên tập tách ra, tiện tham khảo hoặc bảo trì.
- `original-react/` — mã nguồn React 18 slide phiên bản trình chiếu gốc (không có Editor), kèm assets.
- `.github/workflows/deploy.yml` — CI deploy tĩnh lên GitHub Pages.

## Giới hạn

- Chữ gốc có thể sửa bằng chế độ editor; hình/diagram tạo mới có thể kéo thả. Một số họa tiết gốc thuộc layout CSS không phải đối tượng kéo thả.
- Khuyến nghị dùng Chrome hoặc Edge trên desktop.

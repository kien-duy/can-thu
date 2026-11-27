# Cần Thủ

Game câu đài 3D trên web. Tổng quan, cấu trúc thư mục, biến môi trường: `README.md`. Việc còn lại: `TODO.md`. Kiến trúc: `replica/architecture.md`.

## Lệnh

- `npm run dev`: game + API ở http://localhost:5173
- `npm run typecheck && npm run lint && npm test && npm run build`: bắt buộc pass trước khi commit
- `npx playwright test --project=chromium`: e2e. Đừng để `vite preview` chạy sẵn ở cổng 4173 (Playwright dùng lại server đó, test nhầm bản cũ)
- Đổi `server/db/schema.ts` thì chạy `npm run db:generate`
- `?fast=1&seed=3&store=local` để thử nhanh

## Quy ước

- Viết bằng tiếng Việt: commit message, PR, `TODO.md`, chữ trong game. Commit message như các commit gần đây (`git log -5`): một dòng tóm tắt, rồi gạch đầu dòng nói đã đổi gì và vì sao.
- `src/sim/` là hàm thuần, tất định; thay đổi ở đó phải có unit test.
- `replica/screens/` không bao giờ được commit (repo public).

## TODO.md

- `[ ]` là chưa làm, `[x]` là xong (ghi thêm "xong YYYY-MM-DD").
- `🙋` ở đầu mục: cần chủ dự án (tài khoản bên ngoài, thiết bị thật, quyết định thiết kế). Không tự làm.
- `(đang làm)` trong mục: chủ dự án đang làm ở một máy khác. Không đụng vào.
- Khi chủ dự án nói "bắt đầu làm mục X": thêm `(đang làm)` vào mục đó, commit "TODO: đang làm <mục>", push lên `main`. Làm xong thì bỏ `(đang làm)` và tick.

## Làm việc trên hai máy

Chủ dự án làm ở nhà và ở công ty. Hook trong `.claude/settings.json` tự `git pull --ff-only` khi mở phiên (nếu working tree sạch) và nhắc khi còn commit chưa push. Cuối mỗi buổi làm việc, nhắc chủ dự án commit và push.

## Agent cải tiến hằng đêm

Áp dụng khi phiên được chạy bởi routine "Cần Thủ: cải tiến hằng đêm". Mỗi lần chạy:

1. Nếu đã có PR mở của agent (nhánh `agent/...`) thì dừng, không làm gì.
2. Chọn **một** việc nhỏ, theo thứ tự ưu tiên:
   1. Bug tìm thấy khi đọc code hoặc chạy test
   2. Mục `[ ]` trong `TODO.md` không có `🙋` hay `(đang làm)`
   3. Test còn thiếu cho logic quan trọng (`src/sim/`, `src/game/`, `server/`)
   4. Tech debt, hiệu năng
   5. Nâng dependency bản patch/minor (một nhóm gói liên quan mỗi PR)
3. Không được:
   - đổi hình ảnh 3D, UI, bố cục, màu sắc, chữ hiển thị trong game
   - đổi các con số cân bằng game (giá, tỉ lệ, thời gian, xác suất trong `content/` và `src/sim/`)
   - nâng dependency bản major
   - tự nghĩ ra và code tính năng mới
   - sửa file đang nằm trong một PR mở, hoặc trên một nhánh khác `main` có commit trong 3 ngày gần đây (`git branch -r`, `git log`)

   Thấy chỗ nào nên đổi thuộc các loại trên thì thêm vào `TODO.md` một mục `🙋` có số liệu và lý do, đưa vào PR.
4. Tạo nhánh `agent/<mô-tả-ngắn>` từ `origin/main`. Commit theo quy ước ở trên.
5. Chạy `npm run typecheck && npm run lint && npm test && npm run build`, và `npx playwright test --project=chromium` nếu môi trường chạy được. Có bước nào fail mà không sửa được thì không mở PR; dừng và ghi lý do vào báo cáo cuối.
6. Mở PR vào `main`: tiêu đề tiếng Việt, mô tả nêu việc gì, vì sao, đã kiểm tra bằng gì (ghi rõ nếu không chạy được e2e). CI trên GitHub chạy đủ e2e trên ba trình duyệt.
7. Không merge, không push lên `main`.

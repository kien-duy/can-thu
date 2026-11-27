# TODO

Cập nhật 2026-11-27. Đã xong M0 → M3, cộng thêm dòng cá, gãy cần, lưỡi câu. CI xanh ở commit `ddc776f`.
Trạng thái từng tính năng nằm trong [`replica/features.csv`](replica/features.csv): 40 yes, 1 partial, 9 no (chưa tính các mục skip).

`🙋` = cần chủ dự án làm hoặc quyết định; `(đang làm)` = đang làm ở máy khác. Agent cải tiến hằng đêm bỏ qua cả hai (xem `CLAUDE.md`).

Kế hoạch đã chốt cho lần làm tiếp: cho subagent làm **lần lượt** từng mục bên dưới (mỗi lần một agent, xong thì chạy lại toàn bộ test rồi mới sang mục sau), để chơi được đầy đủ trên máy.

## 1. Server và DB chạy trên máy (xong 2026-11-27)

Bỏ Supabase, chuyển sang mô hình caro-clone: server Hono trong `server/`, Drizzle, PGlite khi chạy trên máy và Postgres (Neon) khi lên mạng. `npm run dev` là có cả game lẫn API, không cần Docker.

- [x] Khách tạo ngay khi mở game; tạo tài khoản email + mật khẩu giữ nguyên cá đã câu; đăng nhập ở máy khác; đăng xuất; xoá tài khoản
- [x] Quy tắc ghi cá chuyển từ RPC sang `server/game.ts`, có 19 unit test trên PGlite
- [x] e2e `tests/e2e/account.spec.ts`: câu một con bằng khách, tạo tài khoản, đăng nhập ở trình duyệt khác thấy cùng sổ tay
- [x] Sửa lỗi cũ trong hàng đợi offline: `flush()` lúc hàng đợi trống làm kẹt mọi lệnh ghi sau đó
- [x] Màn chọn vé có lối "Đã có tài khoản? Đăng nhập" (trước đây màn này che menu, máy mới không đăng nhập được)
- [ ] 🙋 Liên kết Google: đã code (`/api/auth/google`), chưa thử vì cần OAuth client trong Google Cloud của bạn
- [ ] Dọn tài khoản khách bỏ hoang (chưa câu con nào, quá 30 ngày không mở) và phiên hết hạn (`sweepSessions` đã có, chưa gọi định kỳ)
- [ ] 🙋 Quên mật khẩu: chưa có (cần gửi email)

## 2. Làm dở

- [x] Kiểu kéo cá thứ hai trong Cài đặt: rê chuột hoặc ngón tay để chỉnh góc cần (bản tham khảo có kiểu này). Xong 2026-11-27: Cài đặt → Kiểu kéo cá → "Rê chuột, ngón tay". Giữ = ghì, nhấc = tay mềm, vị trí ngang chia ba vùng (vùng giữa 40% giữ cần thẳng) gửi cùng sự kiện `steer` như A/D. e2e `tests/e2e/drag-fight.spec.ts`. Chưa thử trên máy cảm ứng thật

## 3. Rà lại sau ba tính năng mới

- [x] Xem bằng mắt trong cảnh 3D (xong 2026-11-27, chụp bằng Playwright ở góc ngồi câu và góc rộng). Đã sửa trong `Scene3D.tsx`: dây trước đây là nét 1 px màu trắng, gần như không thấy trên nền trời, và bắt đầu từ một điểm cố định giữa không trung chứ không phải ngọn cần; nay là dây vàng huỳnh quang dày 2 px, đi ra từ đúng ngọn cần, võng khi chùng, có vệt bọt và vòng gợn ở chỗ cá. Cần trước đây xoay quanh điểm giữa (gốc cần văng ngược chiều); nay xoay quanh tay cầm, nghiêng rõ hơn, ngọn cong về phía cá theo độ căng. Gãy cần trước đây là hai que bắt chéo chữ X, nằm khuất sau lời gợi ý; nay khúc ngọn gập xuống ở chỗ nối, rũ sang phải, có dằm tre sáng màu ở vết gãy, dây chùng thõng xuống nước. Mặt kéo cá kiểu "rê" nay nằm dưới khung phao (trước đây phủ màu lên khung phao), vùng dòng cần mờ dần từ mép vào thay cho tấm phủ cạnh cứng
- [ ] 🙋 Góc rộng toàn cảnh: cần câu nằm khuất sau thanh hành động và bảng kéo cá, nên ở góc này không thấy cần nghiêng hay cần gãy (dây và vệt bọt chỗ cá thì vẫn thấy). Muốn thấy thì phải đổi vị trí camera góc rộng
- [x] Độ khó với người mới (xong 2026-11-27): đo 6000 trận với lưỡi số 3 ở Hồ Đồng Xanh, người kéo đúng bài: cá trên 2 kg tuột 41 % (2–3 kg 15 %, 3–4 kg 46 %). Nay xác suất mỗi nhịp vùng chạy = `min(0.3, 0.08 × (cân/sức lưỡi − 1))`: tuột 22 % (2–3 kg 6 %, 3–4 kg 18 %, 4–6 kg 49 %); lưỡi số 5 vẫn giữ trọn cá tới 6 kg. Lần tuột đầu tiên hiện gợi ý mua lưỡi số 5 kèm giá (một lần, cờ `hookTipShown`)
- [x] Dây 1.5 mua được từ cấp 1; lắp với cần tre thì cần gãy trước thẻo. Cửa hàng nay cảnh báo ngay trên món dây khoẻ hơn cần đang lắp, và trên món cần yếu hơn dây đang lắp (xong 2026-11-27)
- [x] Lời gợi ý trong trận kéo đổi liên tục trong vùng `aria-live`: trình đọc màn hình đọc quá nhiều. Đã tách: lời gợi ý trên màn hình không còn `aria-live`; một vùng đọc ẩn riêng chỉ đổi khi cá đổi hướng, cá đuối, dây sắp đứt, hoặc có kết quả (xong 2026-11-27)
- [x] Kinh tế (xong 2026-11-27): đo bằng sim thật, 100 ca mỗi cấu hình. Trước đó chơi chăm ở Hồ Đồng Xanh lãi ~850 xu/giờ, nửa idle ~60, Hồ núi Mây gấp đôi hồ dịch vụ. Đã chia đôi giá cá, vé và giá mồi; hệ số bán ở sông 0,7→0,85, ở Hồ núi Mây 0,7→0,4. Nay chơi chăm lãi ~430 xu/giờ, nửa idle ~30–45; sông bằng ~0,65 lần hồ dịch vụ, núi ~1,1 lần. Bảng số liệu và mục tiêu ở [`replica/economy.md`](replica/economy.md)
- [x] Nhịp cá cắn cho người chơi nửa idle (xong 2026-11-27): trước đây cá rỉa 10–30 s rồi qua cửa sổ giật là bỏ đi, người quay lại sau báo rỉa 20–60 s lỡ ~80 % lượt cắn ở hồ dịch vụ, ~95 % ở sông. Nay cá không giật kịp thì nhả mồi, lượn 6–16 s rồi rỉa đợt mới (tối đa 4 đợt, mỗi lần quay lại 25 % cá hoảng bỏ đi, mồi rã thì hết đợt); mỗi đợt báo động lại. Cửa sổ giật vẫn ngắn, giật sớm vẫn hỏng. Nửa idle nay lỡ ~36 % ở hồ, ~46 % ở sông; chăm lãi gấp ~2 lần nửa idle (trước ~12 lần). `REBITE` trong `src/sim/bite.ts`, test `src/sim/rebite.test.ts`, số đo trong [`replica/economy.md`](replica/economy.md)

## 4. M4: có thì tốt

- [ ] 🙋 Thành tích có bậc, danh hiệu
- [ ] PWA: manifest, service worker, cài lên màn hình chính
- [ ] Tiếng Anh: tách chuỗi ra file i18n
- [x] Mặt cắt 2D (xong 2026-11-27): Cài đặt → Cảnh câu → "Mặt cắt 2D" (`prefs.scene`, bản lưu cũ mặc định 3D). Vẽ bằng SVG trong `src/ui/CrossSection.tsx`, không tải và không gắn Scene3D. Nhìn ngang bờ: người câu đội nón ngồi ghế, nước đục dần theo độ sâu (quanh lưỡi bớt đục để thấy mồi), bóng cá mờ cùng một hình, cỡ trong khoảng chung hẹp, không lộ loài hay cân nặng. Bóng cá cắn câu đi theo kế hoạch cắn của sim: tới giờ rỉa thì bơi lại, mỗi nhịp phao giật là một lần đớp, cửa sổ giật thì ngậm mồi, lỡ thì lượn vòng chờ đợt sau, hết đợt thì bỏ đi; kế hoạch rỗng thì không có bóng nào. Trận kéo: giữ nút/Space/chuột thì người ngả ra sau gồng, cần cong; cá bị dắt về bờ, vùng sát mặt thì bắn bọt; gãy cần thì khúc ngọn gập, đứt dây thì dây chùng và bóng vụt đi; vớt thì nhấc bóng cá lên (bảng kết quả mới nói cá gì). Mặt hồ: sóng nhiều lớp, phao nhấp nhô, gợn lúc quăng, lúc phao giật, lúc giật dính và lúc nhấc cá, lấp lánh, vệt nắng dưới nước; màu theo giờ và thời tiết, đêm tối hơn, mưa có hạt lăn tăn. Giảm chuyển động thì ít bóng, sóng nhỏ, không lấp lánh; tab ẩn thì cảnh dừng. Toán vị trí trong `src/game/crossSection.ts` (test `crossSection.test.ts`), e2e `tests/e2e/cross-section.spec.ts`. Chưa xem cảnh gãy cần bằng mắt (chỉ có unit test)
- [ ] 🙋 Sơ đồ hồ, đổi chỗ ngồi
- [ ] 🙋 Hàng xóm NPC câu quanh hồ
- [ ] 🙋 Đi dạo quanh hồ, quán nước
- [ ] 🙋 Đồ trang trí (chỉ đổi hình thức)
- [ ] 🙋 Bản mobile: bố cục dọc, nút chạm to, thử trên iPhone/Android
- [ ] 🙋 Bảng xếp hạng: cần chuyển phần tính kết quả lên server (xem "Gian lận" trong `replica/architecture.md`)

## 5. Việc chỉ bạn làm được

- [ ] 🙋 Khi muốn đưa lên mạng: tạo DB Neon và một host chạy Node (Render như caro-clone), theo mục "Deploy" trong README
- [ ] 🙋 Nếu muốn nút Google: tạo OAuth client trong Google Cloud, đặt `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`
- [ ] 🙋 Đo báo động 10 phút trên Chrome và Safari thật: `npm run dev`, mở `/spike.html`, "Đo đầy đủ", bật thông báo, rời tab 10 phút, rồi chép JSON vào `replica/m0-spike-results.md`
- [ ] 🙋 Đồ hoạ: chọn model CC0 (Kenney, Quaternius, Poly Haven) hoặc nhờ người vẽ theo logo brief trong `replica/brand.md`; ghi nguồn vào `ASSETS.md`

## Ghi chú cho lần làm tiếp

- Chạy trước mỗi lần push: `npm run typecheck && npm run lint && npm test && npm run build && npx playwright test --project=chromium --project=webkit`. Firefox không mở được trong Playwright trên máy này (lỗi môi trường); CI có chạy Firefox.
- Đừng để `vite preview` chạy sẵn ở cổng 4173: Playwright sẽ dùng lại server đó và test nhầm bản build cũ.
- DB trên máy nằm ở `.data/pglite` (xoá là về trống). Đổi `server/db/schema.ts` thì `npm run db:generate`.
- e2e chạy bản production thật (`npm start`, PGlite trong bộ nhớ) ở cổng 4173.
- `?fast=1&seed=3&store=local` để thử nhanh; ở `?fast=1` store được gắn vào `globalThis.__canThu` cho e2e.

# Kinh tế: đo thu nhập theo giờ và mục tiêu

Đo ngày 2026-11-27 (TODO mục 3, "ca 2 tiếng chơi chăm kiếm khá nhiều xu").

## Cách đo

Một script tạm (không nằm trong repo) chạy đúng `reduce` của `src/sim/game.ts` và các hàm của `src/game/player.ts`, 100 ca mỗi cấu hình, mỗi ca một seed, một ngày thời tiết (`weatherFor`) và một giờ bắt đầu trong giờ hành chính (8–16 h). Người chơi đã dò đáy (`soundBottom`), trộn đúng bài mồi cho loài chính ở điểm câu, xả 2–3 nắm mồi mở ổ đầu ca rồi xả thêm khi ổ nhạt. Kéo cá giống `fightUntilLandable` trong `tests/e2e/helpers.ts`: cứ 120 ms nhìn một lần, ghì khi độ căng dưới 0,7, dòng cần ngược hướng cá chạy. Hết ca thì bán cả rọng. Tiền mồi tính theo số lần móc đã dùng (chậu dư mang sang ca sau). Ba kiểu người chơi:

- **chăm**: ngồi nhìn phao suốt, giật đúng cửa sổ 92 % số lần, quăng lại ngay;
- **nửa idle**: đang làm việc. Quăng xong nhìn phao thêm 30 s; sau đó chỉ quay lại khi có báo rỉa, chậm 20–60 s, giật đúng 85 %. Mồi rã mà không có cá thì 0–5 phút sau mới để ý;
- **nửa idle nhanh**: như trên nhưng quay lại sau 5–25 s.

Cột "lỗ" = tỉ lệ số ca bị lỗ. Lãi = tiền bán − vé − mồi. Số liệu là trung bình **mỗi giờ thật**.

## Trước khi chỉnh

| Cấu hình | Kiểu | cá/h | bán/h | vé/h | mồi/h | **lãi/h** | xp/h | lỗ |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Hồ Đồng Xanh, đồ cấp 1, vé 1 h | chăm | 39,5 | 969 | 59 | 63 | **847** | 228 | 0 % |
| | nửa idle | 7,0 | 171 | 59 | 53 | **59** | 39 | 22 % |
| | nửa idle nhanh | 27,7 | 688 | 59 | 55 | **574** | 161 | 0 % |
| Hồ Đồng Xanh, đồ cấp 1, vé 2 h | chăm | 39,5 | 958 | 50 | 61 | **847** | 225 | 0 % |
| | nửa idle | 6,9 | 176 | 50 | 50 | **76** | 40 | 14 % |
| Hồ Đồng Xanh, đồ cấp 1, vé 4 h | chăm | 39,4 | 955 | 45 | 59 | **850** | 225 | 0 % |
| | nửa idle | 7,2 | 182 | 45 | 50 | **87** | 41 | 4 % |
| Bến sông làng, cấp 2, mồi cám thơm | chăm | 34,5 | 481 | 0 | 40 | **441** | 121 | 0 % |
| | nửa idle | 1,4 | 41 | 0 | 31 | **10** | 9 | 51 % |
| | nửa idle nhanh | 17,2 | 307 | 0 | 34 | **273** | 71 | 0 % |
| Hồ núi Mây, cấp 4, mồi ngô chua, câu lửng, lưỡi 8 | chăm | 24,9 | 1669 | 0 | 41 | **1628** | 614 | 0 % |
| | nửa idle | 2,3 | 174 | 0 | 34 | **140** | 58 | 2 % |
| | nửa idle nhanh | 17,7 | 1230 | 0 | 34 | **1195** | 438 | 0 % |
| Hồ núi Mây, cấp 4, mồi mè trắng | chăm | 25,2 | 1376 | 0 | 45 | **1331** | 602 | 0 % |

Nhận xét: người chơi chăm lãi khoảng 850 xu/giờ ở hồ dịch vụ, mua cần carbon sau nửa tiếng và đủ cả bộ đồ nghề (4780 xu) sau chừng 5 giờ. Hồ núi Mây (miễn phí) lãi gấp đôi hồ dịch vụ vì cá ở đó nặng (60 kg/giờ so với 22 kg/giờ), nên lên cấp 4 rồi thì hồ dịch vụ thành vô nghĩa. Sông bằng khoảng nửa hồ dịch vụ.

## Mục tiêu

1. Hồ Đồng Xanh, cấp 1, vé 1 giờ: nửa idle lãi nhỏ (vài chục xu, thỉnh thoảng lỗ), chăm lãi rõ (vài trăm xu).
2. Món nâng cấp đáng kể đầu tiên (lưỡi số 5 + cần carbon, 950 xu, có sẵn 500 xu khởi đầu): người chơi chăm mua được sau 1 ca 2 giờ; nửa idle nhanh trong 1–2 ca.
3. Cả bộ đồ nghề: khoảng 10 giờ chơi chăm, không phải 5.
4. Sông (cấp 2, miễn phí): khoảng 0,6–0,7 lần hồ dịch vụ. Đổi lại không mất vé, không giới hạn giờ, có loài riêng.
5. Hồ núi Mây (cấp 4, miễn phí): ngang hoặc hơn hồ dịch vụ một chút (khoảng 1,1 lần), không gấp đôi.
6. Cấp 2 và cấp 4: không chỉnh lần này (công thức xp nằm trong code, `catchXp`/`levelOf`). Theo số đo: cấp 2 (60 xp) đến ngay sau 1–2 con cá loài mới (+50 xp mỗi loài mới). Cấp 4 (540 xp) đến sau khoảng 1–1,5 giờ chơi chăm, tính cả thưởng loài mới ở Hồ Đồng Xanh; nửa idle (39 xp/giờ) cần khoảng 5 giờ, tức 2–3 ngày.

Giới hạn: nửa idle chậm 20–60 s thì bỏ lỡ gần 80 % lượt cắn câu ở hồ dịch vụ và 95 % ở sông, vì cá rỉa chỉ 10–30 s (mương 10–16 s). Tỉ lệ giữa người chơi chăm và nửa idle (khoảng 5 lần ở hồ, 30 lần ở sông) là do nhịp cá cắn, giá cả không đổi được. Đổi giá chỉ dời cả hai lên hoặc xuống. Vì thế giá được chỉnh để người chơi chăm hết "giàu nhanh", còn nửa idle vẫn có lãi nhỏ. Thưởng nhiệm vụ ngày (khoảng 150 xu/ngày, không phụ thuộc số cá) giữ nguyên, nên tính tương đối nó nặng gấp đôi trước, và đỡ cho người chơi nửa idle nhiều nhất.

## Đã chỉnh

| Giá trị | Cũ → mới | Lý do |
|---|---|---|
| `priceXuPerKg` mọi loài (`species.json`) | chia đôi, làm tròn lên: rô phi 35→18, điêu hồng 50→25, chép 60→30, diếc 120→60, trắm cỏ 55→28, mè hoa 30→15, trôi 30→15, chim trắng 45→23, mương 40→20, rô đồng 140→70, chày 70→35, ngạnh 160→80, lăng 180→90, trắm đen 90→45, mè trắng 25→13 | thu nhập theo giờ giảm một nửa; giữ nguyên tỉ lệ giá giữa các loài |
| Vé Hồ Đồng Xanh (`locations.json`) | 1 h 60→30, 2 h 100→50, 4 h 180→90 | giữ tỉ lệ vé/tiền bán như cũ, để nửa idle vẫn lãi nhỏ |
| `packXu` mọi nguyên liệu mồi (`bait.json`) | chia đôi, làm tròn lên: bột nền 20→10, bột tôm 40→20, sữa ngô 35→18, cám rang 15→8, ngô ủ chua 30→15, tinh chua 30→15, bột rã 25→13, bột keo 25→13, giun 45→23, ốc xay 60→30 | như vé: mồi chiếm khoảng 30 % tiền bán của người nửa idle; không chia đôi thì họ lỗ |
| `saleFactor` Bến sông làng | 0,7→0,85 | sau khi chia đôi giá, sông còn 0,52 lần hồ; nay 0,63–0,7 lần |
| `saleFactor` Hồ núi Mây | 0,7→0,4 | cá núi nặng gấp ba cá hồ dịch vụ; lái cá phải chở xuống núi nên trả rẻ. Nay ~1,1 lần hồ dịch vụ thay vì 1,9 |

Không đổi: giá đồ nghề, thưởng nhiệm vụ, 500 xu khởi đầu, nhịp cá cắn, luật kéo cá. Cả ba thứ đầu tính tương đối nay đáng giá gấp đôi số giờ chơi.

## Sau khi chỉnh

| Cấu hình | Kiểu | bán/h | vé/h | mồi/h | **lãi/h** (trước) | lỗ |
|---|---|---:|---:|---:|---:|---:|
| Hồ Đồng Xanh, đồ cấp 1, vé 1 h | chăm | 490 | 30 | 31 | **429** (847) | 0 % |
| | nửa idle | 86 | 30 | 26 | **30** (59) | 22 % |
| | nửa idle nhanh | 347 | 30 | 28 | **290** (574) | 0 % |
| Hồ Đồng Xanh, đồ cấp 1, vé 2 h | chăm | 484 | 25 | 31 | **428** (847) | 0 % |
| | nửa idle | 89 | 25 | 25 | **39** (76) | 14 % |
| Hồ Đồng Xanh, đồ cấp 1, vé 4 h | chăm | 483 | 22 | 30 | **431** (850) | 0 % |
| | nửa idle | 92 | 22 | 25 | **44** (87) | 4 % |
| Bến sông làng, cấp 2, mồi cám thơm | chăm | 291 | 0 | 20 | **271** (441) | 0 % |
| | nửa idle | 25 | 0 | 16 | **9** (10) | 45 % |
| | nửa idle nhanh | 186 | 0 | 17 | **169** (273) | 0 % |
| Hồ núi Mây, cấp 4, ngô chua, lửng, lưỡi 8 | chăm | 485 | 0 | 20 | **465** (1628) | 0 % |
| | nửa idle | 51 | 0 | 17 | **34** (140) | 8 % |
| | nửa idle nhanh | 358 | 0 | 17 | **340** (1195) | 0 % |
| Hồ núi Mây, cấp 4, mồi mè trắng | chăm | 401 | 0 | 23 | **378** (1331) | 0 % |

Số cá/giờ và xp/giờ không đổi (giá không ảnh hưởng tới sim).

Số giờ chơi để mua (tính từ 500 xu khởi đầu, vé 2 giờ, chưa tính nhiệm vụ):

| Mốc | chăm | nửa idle nhanh | nửa idle |
|---|---:|---:|---:|
| Lưỡi số 5 + dây 1.5 (400 xu) | có sẵn | có sẵn | có sẵn |
| Lưỡi số 5 + cần carbon (950 xu) | 1,1 h (trước 0,5) | 1,5 h (trước 0,8) | 12 h, khoảng 2 ngày nếu có nhiệm vụ (trước 6 h) |
| Cả bộ đồ nghề (4780 xu) | 10 h (trước 5) | 15 h (trước 7) | rất lâu: khoảng 2–3 tuần chơi 2 giờ/ngày, chủ yếu nhờ nhiệm vụ |

## Còn chưa chắc

- Mô hình người chơi nửa idle là giả định (thời gian phản ứng, 30 s nhìn phao sau khi quăng, cách xả mồi). Lãi của họ nhạy với các giả định này hơn nhiều so với giá: phản ứng trong 5–25 s thay vì 20–60 s là lãi gấp gần 10 lần.
- Ở sông, người chơi nửa idle gần như không câu được gì (mương rỉa 10–16 s, cửa sổ giật 0,6 s). Giá không sửa được việc này. Muốn sửa phải đổi nhịp cắn câu của loài sông, tức sửa sim, ngoài phạm vi lần chỉnh này.
- Cấp lên nhanh với người chơi chăm (cấp 4 sau khoảng 1–1,5 giờ). Muốn chậm lại thì phải sửa `catchXp`/`levelOf` (code), chưa làm.
- Bộ đồ trong số đo không lệch (dây không khoẻ hơn cần), nên không có ca gãy cần. Không tính việc đổi bài mồi giữa ca, câu ban đêm (lăng, ngạnh), hay người chơi kéo cá vụng hơn `fightUntilLandable`.

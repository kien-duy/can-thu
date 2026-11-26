# Recon map: Câu Đài Hồ Dịch Vụ (web, desktop + mobile)

Scope: vòng câu đài lõi (chọn hồ → cân phao → trộn mồi → quăng → đọc phao → giật → kéo → vớt → cân cá cuối ca) và các hệ thống bám quanh nó (sổ tay, đồ nghề, nhiệm vụ, kinh tế). Không tính phần online/xã hội.
For: game câu đài của riêng chủ dự án, cho dân văn phòng vừa làm vừa câu. Bản làm lại theo kiểu clean-room: chỉ học cơ chế và luồng chơi, không lấy code, hình, chữ hay tên.
Date: 2026-11-26

> Footer của game ghi rõ "Mọi quyền được bảo lưu — không sao chép, đăng lại hay sửa đổi game". Vì vậy file này chỉ mô tả **chức năng**, mọi câu chữ đều đã diễn đạt lại. Không đọc JS bundle, không ghi network.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Bản game chạy thật, chơi với tư cách khách | https://cauca-trieutam.netlify.app | Đọc các bảng UI bằng văn bản hiển thị, chụp 6 màn hình (`screens/`) |
| 2 | Bảng Hướng dẫn trong game | (trong game, nút ❔) | Toàn bộ phím điều khiển, cách chơi trên điện thoại, đi dạo |
| 3 | Bảng Nhịp phao trong game | (trong game, nút 📈) | Thư viện khoảng 45 nhịp phao theo loài: nguồn đặc tả quý nhất |
| 4 | Bảng Cài đặt + footer | (trong game, nút ⚙️) | Tùy chọn góc nhìn, khung phao, kiểu kéo cá; thông tin bản quyền |

Không có trang help, bảng giá hay changelog công khai. Chưa xem được pha kéo cá: khi khung trình duyệt bị ẩn thì vòng lặp game dừng, nên phần kéo cá lấy theo bảng Hướng dẫn.

## Core loop

Mua vé một ca ở hồ dịch vụ → cân phao và trộn mồi theo loài, theo thời tiết → quăng vào ổ, xả mồi mở ổ → đọc đúng nhịp phao của loài để giật → ghì và dòng cá cho tới khi cá đuối → vớt → cuối ca cân cá đổi tiền, lấy tiền mua đồ tốt hơn, vào hồ đắt hơn.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Chào mừng / mời đăng nhập | modal lần đầu mở | mời đăng nhập (Google hoặc user+mật khẩu) hoặc chơi luôn | 3 thẻ lợi ích, 2 CTA, "không hiện lại trong N giờ" | guest |
| S02 | Chọn góc nhìn | modal thứ 2 | chọn 3D ngồi câu hoặc 2D mặt cắt | 2 thẻ có ảnh xem trước, badge "nên chọn" | — |
| S03 | Chọn hồ | modal thứ 3, nút 🎣 | danh sách 8 hồ: vé, thời lượng ca, giá thu cá, số người online, luật hồ, điều kiện cần (≥4H) | thẻ hồ, nút Mua vé, banner ủng hộ, banner online, giải Chủ nhật, nhiệm vụ hôm nay, mời bạn | đang câu / bị khoá vì cần yếu |
| S04 | Màn câu 3D | sau khi vào ca | cảnh hồ 3D từ sau lưng người câu, hàng xóm NPC, dù, đèn lồng | thẻ trạng thái trái trên, thanh menu 12+ nút, **khung ngắm phao** phải trên, thanh đồ nghề + thanh hành động dưới, coach bar | chờ quăng, mồi đang chìm, canh phao |
| S05 | Màn câu 2D mặt cắt | ⚙️ hoặc phím G | mặt cắt bờ hồ: thấy dây, phao, chì, cá dưới nước | — | chưa xem |
| S06 | Coach bar hướng dẫn 4 bước | vé câu thử lần đầu | Quăng → Canh phao → Giật → Vớt | thanh đáy, bước x/4, Bỏ qua | đúng, thả vội, giật trượt |
| S07 | Phao báo / giật | trong ca | dòng chữ giải nghĩa nhịp phao, khung phao đỏ khi cần giật | toast giải thích, khung phao nhấp nháy | trượt (muộn) |
| S08 | Kéo cá | sau khi giật dính | ghì (giữ) / tay mềm (thả), dòng cá trái phải, chỉnh góc cần, nút Vớt nhấp nháy | thanh sức cá, sức cần | chưa xem trực tiếp |
| S09 | Bàn cân phao | phím C | cắt chì (g), độ sâu phao (cm), dò đáy, 6 kiểu cân làm sẵn, độ dài thẻo, chênh lưỡi, ấn thử phao | stepper −−/−/+/++, preset card, gợi ý theo nhiệt độ nước | — |
| S10 | Trộn mồi | phím B | chậu mồi câu và chậu mồi xả; bài gợi ý theo loài và theo hồ; kiểu mồi kéo/vê; độ nhào; độ hạt; tỉ lệ nước/bột; thời gian ủ | bảng nguyên liệu (muỗng/nắp), chỉ số rã/bám | chậu còn N lần móc |
| S11 | Sổ tay | nút 📖 | thống kê ca, nhật ký câu từng con, 11 loài ẩn "???", tủ cúp 0/12, chơi lại từ đầu | thẻ loài ẩn | trống |
| S12 | Kho nhịp phao | nút 📈 | khoảng 45 nhịp phao (CHỜ / GIẬT / ĐỪNG GIẬT…) mô phỏng bằng vật lý phao thật, có biểu đồ và nút tập giật | biểu đồ thời gian, vùng xanh/cam, ▶ Xem | — |
| S13 | Rọng | nút 🧺 | cá đang giữ trong ca | danh sách | trống |
| S14 | Túi đồ | nút 🎒 | đồ đang có theo mục, đổi nhanh, kho nguyên liệu mồi (9/23 loại) | thẻ đồ, ⭐ đang dùng | — |
| S15 | Cửa hàng | nút 🛒 | 6 tab: cần, dây & thẻo, lưỡi, phao, phụ kiện, mồi; gợi ý hợp hồ; 3 dòng cần × 4 chiều dài × 4 độ cứng; cần VIP | bộ chọn kích cỡ, bảng chỉ số (câu xa, chịu lực, điệu, độ nhạy…), "thiếu Nk" | — |
| S16 | Nhiệm vụ | nút 📋 | điểm danh 30 ngày, nhập môn (10), hôm nay (3), mời bạn, cột mốc | checklist, tiến độ x/y, thưởng | — |
| S17 | Cộng đồng | nút 👥 | thành tích 101 bậc / 34 danh hiệu, kỷ lục, giải theo giờ, bạn bè, tin nhắn, hội câu, nhóm Facebook | bậc đồng/bạc/vàng | — |
| S18 | Trang trí | nút 🎨 | phòng thử đồ: 14 slot (dù, áo, mũ, thùng, ghế, đèn, biển tên, xe máy, sơn cần, tăm phao, màu dây, màu lưỡi, thân phao, bộ đồng bộ), 5 hạng giá, có xem ban đêm | mặc thử, mua | — |
| S19 | Cài đặt | nút ⚙️ | góc nhìn, khung phao (kéo được/khoá, cỡ), dòng chữ kiểu đang câu, kiểu kéo cá (giữ để ghì / rê chuột), tin người cùng hồ | radio group | — |
| S20 | Hướng dẫn | nút ❔ | bảng phím, cách chơi trên điện thoại, đi dạo / quán nước / ngồi xem hàng xóm | danh sách phím | — |
| S21 | Sơ đồ hồ | phím M | ô câu, gió, máy sục, hàng xóm, đổi chỗ | — | chưa mở |
| S22 | Đi dạo / quán nước / xem hàng xóm | phím T, Enter | đi bộ quanh hồ, ghé quán nước, ngồi xem NPC câu | — | chưa mở |
| S23 | Online / chat | nút 🌐 | phòng chat, emoji, câu nói nhanh | — | chưa dùng |
| S24 | Kết thúc ca / cân cá | 🏁 Kết thúc ca | cân rọng, tính tiền, lãi/lỗ so với vé | — | chưa xem |

## Flows

```
F01 Người mới lên con cá đầu tiên
    S01 (chơi luôn) -> S02 (3D) -> S03 + modal "câu thử" -> S04/S06 quăng -> canh phao -> S07 giật -> S08 kéo -> vớt
    happy path: 3 modal + 4 bước, khoảng 8 thao tác trước khi được quăng lần đầu
    edge: thả vội (lực không đủ), giật muộn (cá nhả), giật sớm (cá rỉa), pane ẩn thì game dừng

F02 Chuẩn bị một ca nghiêm túc
    S03 mua vé -> S09 cân phao (preset hoặc chỉnh tay) -> S10 trộn 2 chậu (câu + xả), ủ 8 phút giờ game -> bật kẹp xả, quăng 10 nắm mở ổ -> câu
    happy path: khoảng 6–10 thao tác nếu dùng preset và bài gợi ý
    edge: đổi đồ thì phải cân lại phao; mồi rã sau khoảng 85 s thì phao nổi dần về nấc cân

F03 Đọc phao và giật
    S04: phao báo (CHỜ / GIẬT / ĐỪNG GIẬT) -> click hoặc Space
    edge: mỗi loài một bộ nhịp; có vùng "ngậm hờ" (giật dễ trượt); cá tạp, quệt dây là báo giả

F04 Kéo và vớt cá
    S08: giữ = ghì, thả = tay mềm, A/D dòng cá ngược hướng cá chạy, W/S góc cần -> nút Vớt nhấp nháy khi cá đuối và gần bờ (vợt 1m8 chỉ với tới 3 m) -> E
    edge: đứt thẻo, gãy cần khi dựng quá cao, cá vượt sức cần

F05 Kết thúc ca và kiếm tiền
    S24: cân cá, bán theo kg hoặc lật vợt nhận thưởng mỗi con -> S15 mua đồ -> S03 mở hồ mới (điều kiện độ cứng cần)

F06 Học nhịp phao
    S12: chọn nhịp -> ▶ Xem mô phỏng -> bấm ⚡ Giật vào vùng xanh để tập
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Modal / panel | lớn (bảng), nhỏ (hỏi) | mở, chồng nhau (tới 3 lớp) | S01–S03, S09–S20 |
| Thanh menu trên | nút emoji + chữ | badge số (Nhiệm vụ 0), co lại thành ⋯ trên mobile | S04 |
| Thẻ trạng thái HUD | — | giờ, thời tiết, ca còn, rọng, lưu, tiền | S04 |
| Khung ngắm phao | nhỏ / vừa / to; kéo được / khoá | bình thường, đỏ khi cần giật | S04 |
| Thanh đồ nghề dưới | — | cần, dây, lưỡi, phao, cân/câu, độ sâu, thẻo, chậu mồi | S04 |
| Thanh hành động dưới | nút có phím tắt | — | S04 |
| Coach bar | bước x/4 | thường, cảnh báo đỏ, Bỏ qua | S06/S07 |
| Stepper số | −−, −, +, ++ | — | S09 |
| Preset card | tag (chuẩn, nhạy, lụt…) | chọn | S09, S10 |
| Bảng nguyên liệu | muỗng / nắp | còn / hết | S10, S14 |
| Thẻ đồ nghề | có / chưa có / đang dùng / thiếu tiền | bộ chọn cỡ | S14, S15 |
| Thẻ hồ | mở / khoá theo điều kiện | đang câu ở đây | S03 |
| Checklist nhiệm vụ | x/y, thưởng | xong / chưa | S16, S17 |
| Biểu đồ nhịp phao | vùng xanh / cam | phát, tua | S12 |
| Toast giải thích | — | tự ẩn | S04 |

## Inferred data model

```
Lake       id, name, species[] (+ tỉ lệ), ticket_price, shift_hours, sale_mode (per_kg | per_fish_bonus | catch_release | ranked),
           price_per_kg{species}, bonus_range, min_rod_power, depth, seats[], aerators
           evidence: S03, S15 "hợp hồ đang câu"      confidence: high

Species    id, name, weight_range, bite_patterns[], diet prefs (tanh/thơm/chua…), temp prefs, feeding layer (đáy / lửng),
           how fast it spits bait, fight strength
           evidence: S12 (khoảng 45 nhịp / 11 loài), S10 ghi chú nguyên liệu, S17 mốc cân nặng      confidence: high

BitePattern id, species_id, label, verdict (WAIT | STRIKE | STRIKE_NOW | DONT), float motion curve, hook window
           evidence: S12      confidence: high (danh sách) / guess (đường cong)

Rod        line (3 dòng), length (3m6–7m2), power (2H–28H), max_load_kg, action (19/28/37), sensitivity, durability, price
Line       main_diameter, leader_diameter, main_break_kg, leader_break_kg; leader_sets_count
Hook       size, hookup_rate
Float      shot_capacity_g, segments (11 nấc)
Net        handle_length, reach_m
           evidence: S14, S15      confidence: high

Ingredient id, name, role (nền | tanh | thơm | kéo sợi | rã | cám | phụ gia | trạng thái | kết dính), unit (muỗng | nắp), stock
BaitMix    kind (câu | xả), ingredients{}, style (kéo | vê), knead_level, grain, water_ratio,
           → derived: dissolve_s, cling_pct, uses_left
           evidence: S10, S14      confidence: high

Rig        shot_g, float_depth_cm, leader_len_cm, hook_gap_cm, cân_nấc, câu_nấc, bottom_depth_m
           evidence: S09      confidence: high

Session    lake_id, seat, start/end game time, weather, water_temp, keepnet[], groundbait_state ("ổ")
Catch      species, weight, time, weather, bait, lake, kept|released
           evidence: S04 HUD, S11 "nhật ký kèm giờ, trời, mồi"      confidence: medium

Player     money, inventory, quests, achievements(101 bậc), titles(34), cosmetics, settings, view_mode
           save: localStorage khi là khách; cloud khi đăng nhập ("Chưa đồng bộ")      confidence: medium

GameClock  ngày + giờ game **chạy nhanh hơn giờ thật** (khoảng 1 phút game ứng với vài giây thật; ca 5 tiếng game ≈ 25–30 phút thật, ước tính)
           evidence: đồng hồ HUD chạy 06:30 → 06:39 trong khoảng 1 phút      confidence: guess
```

Relationships: Lake 1-n Species (theo tỉ lệ), Species 1-n BitePattern, Player 1-n Session, Session 1-n Catch, Player 1-1 Rig/BaitMix đang dùng.

## Feature matrix

See `features.csv`. Must: 25, should: 15, could: 10, skip: 7.

## Out of scope (cannot or should not be cloned)

- Tên game, tên hồ, tên dòng cần, câu chữ trong bảng nhịp phao và bài mồi: thuộc bản quyền của họ. Đặc tả cá thì tự viết lại từ kiến thức câu cá chung.
- Cộng đồng online (1.462 người online lúc xem), nhóm Facebook, giải Chủ nhật bằng người thật: đó là mạng lưới người dùng của họ, không phải tính năng chép được.
- Nạp tiền thật ("💎 Nạp x2"), ủng hộ, mời bạn nhận tiền: đi ngược quyết định "không nạp tiền thật".
- Trang trí thời trang 5 hạng giá, xe máy, Tứ Linh: để sau, không thuộc vòng chơi lõi.
- Đi dạo, quán nước, ngồi xem hàng xóm: hay nhưng tốn công 3D; để giai đoạn sau.

## UX audit: chỗ yếu của bản tham khảo

Chiều sâu mô phỏng của bản tham khảo **rất cao**, vượt cả đề xuất ban đầu của mình. Chỗ yếu nằm ở cách trình bày, không phải ở nội dung:

1. **Ba modal chồng nhau ngay khi mở game** (đăng nhập → góc nhìn → chọn hồ + câu thử). Người chơi phải qua khoảng 8 thao tác mới được quăng lần đầu.
2. **Thanh menu trên có 12–14 nút ngang hàng** (Chọn hồ, Nhiệm vụ, Cửa hàng, Túi đồ, Trang trí, Rọng, Cộng đồng, Sổ tay, Nhịp phao, Thêm vào MH chính, Hướng dẫn, Cài đặt, Âm thanh, Toàn màn hình, ⋯) cộng thêm 7 nút hành động ở đáy, mỗi nút một phím tắt. Không có thứ bậc: việc dùng mỗi phút (cân phao, trộn mồi) nằm ngang hàng với việc dùng mỗi tuần (trang trí, cộng đồng).
3. **Khung ngắm phao nhỏ, đặt ở góc phải trên**, xa tâm màn hình, trong khi phao 3D ở giữa màn hình chỉ còn vài pixel. Mắt người chơi phải nhảy giữa hai chỗ.
4. **Cửa sổ giật rất ngắn**: rô phi nhả mồi trong khoảng dưới 1 giây. Thử nghiệm của mình giật muộn và trượt ngay lần đầu. Người đang làm việc khác gần như không thể chơi kiểu này.
5. **Game dừng khi tab bị ẩn**: vòng lặp game đứng hẳn (đồng hồ đứng ở 06:39). Người văn phòng không thể "thả câu rồi đi làm" được, mà đó lại là nhu cầu chính.
6. **Màn chữ dày đặc**: bảng nhịp phao khoảng 45 mục dạng đoạn văn dài, có chen chữ Hán; bảng cửa hàng mỗi cần một bảng 10 chỉ số; bảng nhiệm vụ trộn 5 loại nhiệm vụ trong một danh sách dài.
7. **Kinh tế bị chèn quảng bá**: banner ủng hộ, nút nạp, nhóm Facebook +500k, mời bạn +100k xuất hiện ngay ở bảng chọn hồ và bảng nhiệm vụ.
8. **Đồng hồ game không theo giờ thật**, nên "câu sáng sớm" trong game không gắn với buổi sáng ngoài đời.
9. Dòng hướng dẫn điều khiển nằm đè lên giữa cảnh 3D ("Chuột phải kéo… Lăn chuột… R… G…").
10. Mobile phải xoay ngang, và nhiều nút chỉ còn biểu tượng hoặc bị giấu trong ⋯.

## Cơ hội cho bản của mình

| vấn đề | hướng làm của mình |
| --- | --- |
| Game dừng khi ẩn tab, cửa sổ giật quá ngắn | Mô phỏng chạy cả khi tab bị ẩn. Có báo động âm thanh, tiêu đề tab và thông báo hệ thống. Cá rỉa kéo dài 10–40 s rồi mới tới cửa sổ giật |
| Hơn 20 nút ngang hàng | 3 tầng: (1) màn câu chỉ còn phao + 1 nút hành động chính theo ngữ cảnh; (2) "khay chuẩn bị" gom cân phao, mồi, đồ nghề; (3) menu gom sổ tay, cửa hàng, nhiệm vụ, cài đặt |
| Khung phao nhỏ ở góc | Chế độ văn phòng: cả cửa sổ là cận cảnh phao. Ở 3D, camera tự zoom vào phao khi cá bắt đầu rỉa |
| 3 modal mở đầu | Vào thẳng một ô câu đã cân sẵn, mồi sẵn; dạy dần trong lúc chơi |
| Chữ dày đặc | Sổ tay theo loài: thẻ có hình, nhịp phao xem bằng animation + một dòng mô tả, chi tiết để ở mục mở rộng |
| Đồng hồ ảo | Đồng hồ theo giờ thật (đã chốt) |
| Chỉ có hồ dịch vụ | Thêm sông quê, hồ núi; động vật ghé qua; mục "Sinh vật đã gặp" |
| Nạp tiền, quảng bá | Không nạp tiền thật, không chèn quảng bá vào luồng chơi |

## Quyết định độ sâu cho bản đầu (2026-11-26): "sâu vừa, mở rộng sau"

Toàn bộ nội dung để dạng dữ liệu (file JSON hoặc bảng DB), nên mở rộng sau này chủ yếu là thêm dữ liệu, ít phải sửa code.

| hệ thống | bản tham khảo | bản đầu của mình |
| --- | --- | --- |
| Loài cá | 11 loài, khoảng 45 nhịp | khoảng 15 loài; mỗi loài 1 nhịp mồi nhử (CHỜ) + 1–2 nhịp ăn thật (GIẬT); thêm khoảng 4 nhịp dùng chung (cá tạp rỉa, quệt dây, mồi rã, đớp giữa tầng) |
| Trộn mồi | khoảng 23 nguyên liệu, độ nhào, độ hạt, tỉ lệ nước, ủ | khoảng 8 nguyên liệu trên 4 trục (tanh, thơm, chua, độ tơi) + kiểu mồi kéo/vê; có bài gợi ý theo loài |
| Cân phao | chì theo gam, độ sâu theo cm, thẻo, chênh lưỡi, 6 kiểu cân | độ sâu theo nấc + dò đáy + 4 kiểu cân làm sẵn; chì tự tính |
| Đồ nghề | 3 dòng cần × 4 chiều dài × 4 độ cứng, cần VIP | 2 dòng cần × chiều dài × độ cứng; vài loại dây, lưỡi, phao, vợt |
| Mồi xả / ổ | có, ổ nguội dần | có, bản đơn giản |
| Kéo cá | ghì, tay mềm, dòng cá, góc cần | ghì, tay mềm, dòng cá; chưa chỉnh góc cần |

## Size

Screens 24 (bản đầu cần khoảng 14), flows 6, entities 12. Hard parts: (1) mô phỏng phao và nhịp ăn theo loài nghe "thật" như bản tham khảo; (2) cảnh 3D + chế độ văn phòng chạy nhẹ trên laptop, mô phỏng khi tab ẩn mà vẫn báo động đúng lúc; (3) mô hình mồi và cân phao ảnh hưởng tới xác suất cá cắn mà người chơi vẫn hiểu được. Size: **L** (khoảng một quý làm bán thời gian cho bản đầu đủ 3 địa điểm).

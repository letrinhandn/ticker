# MARKETPOLY V5 — Luật chơi nhanh

Bạn quản lý một quỹ đầu tư. Mua cổ phiếu và ETF, giữ tiền để trả các khoản bắt buộc, và trụ lại lâu hơn đối thủ. **Quỹ duy nhất chưa phá sản thắng. Không giới hạn số vòng.**

## 1. Chuẩn bị

Mỗi quỹ nhận **5.000 M$** và đặt quân ở START. Đặt 8 thanh ngành ở nấc `0`. Cả bàn chọn một **Market Regime** mở ván hoặc đổ **1 xúc xắc** theo bảng Regime: mặt `1–5` chọn kịch bản tương ứng, mặt `6` giữ tất cả ngành ở `0`. Áp dụng Regime một lần cho cả bàn. Đặt quân lúc mở ván không kích hoạt START.

## 2. Một lượt chơi

**Đổ 2 xúc xắc → di chuyển → xử lý START nếu đi qua → xử lý ô đến → mua hoặc bán một lệnh, hoặc bỏ qua → chuyển lượt.** Đổ đôi không được thêm lượt. Mỗi lệnh tự nguyện chỉ giao dịch **một mã, 1–10 cổ phần hoặc chứng chỉ quỹ**.

| Ô | Cách xử lý |
|---|---|
| **START** | Khi đi qua hoặc dừng tại đây, nộp cho **Nhà nước 10% toàn bộ tiền mặt đang có**, làm tròn xuống M$. Sau đó quyết toán cổ phiếu đang giữ: lấy **(doanh thu theo nấc ngành − chi phí hoạt động) × số cổ**, cộng các mã rồi nhận hoặc trả ròng một lần với Nhà nước. **Không rút Market News, không nhận thưởng cố định. ETF không quyết toán.** |
| **Công ty** | Trả ngay **phí ghé ô/cổ × số cổ họ giữ** cho từng cổ đông khác. Không trả cho chính mình hay Nhà nước. Khoản này không tính lại ở START. |
| **ETF** | Không thu phí ghé ô. |
| **Market News** | Rút ngẫu nhiên 1 trong 100 lá và áp dụng mức dịch ngành ghi trên lá. Lần sau vẫn chọn từ đủ 100 lá. |
| **Ô thuế** | Nộp khoản ghi trên ô cho Nhà nước. Không có thuế tiền mặt cuối lượt. |
| **Weekend** | Không có hiệu ứng; vẫn được giao dịch bình thường. |
| **SEC Investigation** | Chuyển thẳng tới **Trading Suspension**, không kích hoạt START, không giao dịch và kết thúc lượt. Lượt sau, nộp **50 M$ cho Nhà nước** để thoát trước khi đổ, hoặc thử đổ đôi. Không đổ đôi sau 3 lần thử thì nộp 50 M$ cho Nhà nước và đi theo kết quả lần thứ ba. |

## 3. Mua và bán

**Cổ phiếu.** Chốt mã, chiều mua/bán và số cổ. Kiểm tra cổ phần sẵn có; lệnh mua phải đủ tiền cho toàn bộ số cổ ở mức giá cao nhất có thể xảy ra trong các lá khớp, gồm phí. Sau đó bốc ngẫu nhiên từ bộ **100 Price Reaction** đến lá đầu tiên khớp **chiều và số cổ**. Lá không khớp không có hiệu ứng. Đọc hàng ngành đang giao dịch và giá trị MUA hoặc BÁN tương ứng; hai chiều độc lập. Áp dụng tác động trong giới hạn `−5` đến `+5`, rồi thanh toán đủ số cổ **theo giá mới**, với phí **5 M$/lệnh** nộp cho Nhà nước. Hàng toàn `0` vẫn khớp. Lệnh tiếp theo lại xét đủ 100 lá.

**ETF.** Mua/bán theo giá quỹ hiện tại, bằng tổng giá trị các phần ngành trên thẻ. **Không rút Price Reaction, không dịch giá ngành, không thu phí giao dịch.** Không cần đứng đúng ô để mua/bán cổ phiếu hay ETF.

## 4. Thanh lý và thắng

Nếu không đủ tiền trả một khoản bắt buộc, bán tài sản đang giữ cho đến khi đủ tiền hoặc hết tài sản có thể bán. Bán cổ phiếu vẫn xử lý Price Reaction; bán ETF thì không. **Thanh lý không tính vào lệnh tự nguyện.** Nếu bán hết mà vẫn không trả đủ, quỹ phá sản và rời ván. Khi còn đúng một quỹ chưa phá sản, quỹ đó thắng ngay. Tài sản ròng chỉ để theo dõi, không dùng để xử thắng.

---

## Phụ lục A — Lệch engine (playtest digital)

Bảng dưới đối chiếu luật V5 với `src/lib/game/engine.ts` hiện tại. Chưa implement trong bước import luật.

| V5 | Engine hiện tại |
|---|---|
| START: thuế 10% tiền mặt (làm tròn xuống), rồi ops `(DT theo nấc − CP) × cổ` | Chỉ rút Market News + stipend Bull 200 / Bear 100; **chưa** thuế 10%; **chưa** ops |
| START: không News, không thưởng cố định | `afterStartEffects` vẫn flip News + pay |
| Mở ván: Regime chọn tay hoặc 1d6 (1–5 kịch bản, 6 = giữ 0) | `createGame` rút 1 lá từ deck News |
| News ô: mỗi lần chọn từ đủ 100 lá | Deck rút / discard tuần tự |
| PR: phí 5 M$/lệnh; đủ tiền worst-case trước khi bốc | Có match chiều + số cổ; **chưa** phí 5; afford khác |
| Weekend: không hiệu ứng | Info card + trade |
| Thắng: chỉ quỹ cuối chưa phá sản | Có `finished` / `winnerId` — cần khớp last-standing |
| Không cần đứng đúng ô để giao dịch | Trade sau land / `focusTile` — luật cho phép bất kỳ mã |

**Ghi chú:** Bảng Regime mặt xúc xắc 1–5 chưa liệt kê trong luật nhanh; dùng bảng Regime playtest đi kèm khi wire mở ván.

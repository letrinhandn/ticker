# Docs

| Path | Role |
|------|------|
| [`rulebook/MARKETPOLY_RULEBOOK_V5.md`](rulebook/MARKETPOLY_RULEBOOK_V5.md) | Shipped rules (rendered at `/rules`) |
| [`archive/`](archive/) | Historical / design-only files (V2–V4 rulebooks, unused deck variants, ETF design JSON) |

## Runtime game content (canonical)

Bundled JSON lives in **`src/content/`**, not here:

- `companyCards22.json`
- `marketNews100.json`
- `priceReactions100.json`

Do not duplicate those files under `docs/`.

## Opening Regime (playtest)

Luật V5 cho phép mở ván bằng Regime chọn tay hoặc đổ 1 xúc xắc (mặt `1–5` = kịch bản, `6` = giữ mọi ngành ở `0`). Bảng chi tiết 5 kịch bản đi kèm playtest khi wire engine; luật nhanh không liệt kê số liệu từng mặt.

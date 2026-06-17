---
name: maintain-feature
description: Ghi nhận task bảo trì (bug fix / cải tiến) lên một feature ĐÃ TỒN TẠI trong Document Kit — sửa spec tại chỗ rồi bump version + CHANGELOG, không tạo feature mới. Dùng khi dự án chạy Agile và có ticket sửa bug hoặc cải tiến nhỏ. Trigger: "fix bug feature X", "cải tiến/sửa spec feature", "ghi maintenance vào kit", "log change cho feature".
---

# Skill: maintain-feature

Dự án Agile: sau khi feature `done` vẫn liên tục có **bug fix / cải tiến**. Đây *không phải*
feature mới — **đừng** tạo feature mới, **đừng** chạy lại ingest/compile từ đầu. Chỉ sửa đúng phần
đổi trong spec hiện có, rồi ghi nhận thay đổi (bump version + CHANGELOG).

## Quy trình

1. **Map ticket/branch → feature**
   - `find_feature(ticket | query)` (hoặc `doc-kit find --ticket … / --query …`).
   - Không tìm thấy (code cũ chưa có doc) → đề xuất tạo feature tối thiểu (`doc-kit new`) hoặc gắn
     vào feature catch-all; **hỏi reviewer**, đừng tự bịa feature.

2. **Đọc context**
   - `AGENTS.md` (hiến pháp), `get_feature(id)` (trọn gói), shared docs khi cần
     (`glossary`/`data-models`/`conventions`).

3. **Phân loại thay đổi**
   - `bugfix` (sai so với spec/AC), `improvement` (cải tiến nhỏ), `chore` (dọn dẹp/không đổi hành vi).
   - Xác định đụng đâu: nghiệp vụ (BR-/AC-), design (state/Figma), hay **API**.

4. **Sửa spec tại chỗ (surgical)**
   - Chỉnh đúng phần trong `01-business-spec.md` / `02-design-spec.md`, **giữ nguyên heading template**.
   - Thêm/sửa `BR-`, `AC-`, state design… đúng phạm vi ticket; chỗ chưa chắc → "Open questions".
   - **Đụng API?** → dùng skill `attach-api` / `push_api_doc` (tự bump `api.version` + CHANGELOG).
     **Không** sửa tay `03-api/api-spec.md` (kit sinh).

5. **Ghi nhận thay đổi**
   - `log_change(id, type, note, ticket?, repull?)` (hoặc `doc-kit log-change <id> --type … --note …
     [--ticket …] [--repull]`).
   - Bump `feature.version`, ghi entry CHANGELOG có phân loại, gắn ticket vào `tickets[]`.
   - **Status giữ nguyên** — feature `done` vẫn `done` (chỉ bump version).
   - Đổi hành vi user-facing → `repull=true` (set `needs_fe_repull` để FE pull lại).

6. **Cập nhật FE task**
   - Thêm task vào `04-fe-tasks.md` với `Loại=bugfix/improvement`, tham chiếu AC + entry CHANGELOG
     thay vì viết lại toàn bộ context.

7. **Báo cáo reviewer** — tóm tắt: feature nào, loại gì, đụng spec nào, có cần FE re-pull không.
   **Không commit** — để reviewer merge.

## Nguyên tắc
- Bảo trì = sửa feature có sẵn, **không** sinh feature mới.
- Mọi thay đổi có ý nghĩa = **bump version + ghi CHANGELOG** (qua `log_change`/`push_api_doc`).
- Thay đổi nghiệp vụ/design → `log_change`; thay đổi API → `push_api_doc`. Đừng lẫn lộn.
- Trung thực: chỗ suy luận/chưa chắc → "Open questions", đừng bịa thành sự thật.

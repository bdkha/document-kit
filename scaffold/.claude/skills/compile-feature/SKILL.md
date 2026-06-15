---
name: compile-feature
description: Biên dịch docs nghiệp vụ thô (00-raw/) + Figma của một feature trong Document Kit thành 01-business-spec.md và 02-design-spec.md theo template chuẩn, để người review. Dùng khi user nói "compile feature X", "biên dịch spec cho feature", "viết business/design spec từ docs thô + Figma".
---

# Skill: compile-feature

Biến input thô của BA thành spec mà AI đọc được, theo template của kit. **Bán tự động**: bạn sinh nháp, con người review & merge.

## Khi nào dùng
User muốn biên dịch một feature (đã có thư mục `features/<id>/` và docs thô trong `00-raw/`).

## Quy trình

1. **Đọc bối cảnh kit trước**
   - Đọc `AGENTS.md` (hiến pháp) và `shared/glossary.md`, `shared/conventions.md`, `shared/data-models.md`.
   - Đọc `features/<id>/feature.yaml` để biết title, figma links, platforms.

2. **Thu thập nguồn**
   - Đọc mọi file trong `features/<id>/00-raw/`.
   - Với mỗi Figma link trong `feature.yaml` → dùng **Figma MCP**:
     - `get_design_context` / `get_metadata` để lấy cấu trúc + component.
     - `get_variable_defs` để lấy design tokens.
     - `get_screenshot` để export ảnh (lưu vào `features/<id>/02-design-assets/` nếu cần).

3. **Sinh `01-business-spec.md`** theo `templates/01-business-spec.md`:
   - Giữ nguyên các heading. Điền Goal, Actors, User Stories, Flows, Business Rules (BR-n), Acceptance Criteria (AC-n, Given/When/Then), Edge cases.
   - Thuật ngữ → **link** tới `shared/glossary.md`, đừng định nghĩa lại. Nếu gặp thuật ngữ mới quan trọng, đề xuất thêm vào glossary (hỏi user).
   - Mọi suy luận/giả định → đưa vào mục **Open questions**, không bịa.

4. **Sinh `02-design-spec.md`** theo `templates/02-design-spec.md`:
   - Liệt kê screens + node id Figma, cấu trúc component, design tokens (bảng), states/interactions, platform notes (Web vs React Native).

5. **Cập nhật `feature.yaml`**
   - `status`: nếu đang `draft` và đã có business+design → đề xuất `in-design`.
   - `version`: bump nếu biên dịch lại.
   - `updated_at`: hôm nay.

6. **Báo cáo cho người review**
   - Tóm tắt: đã sinh gì, các Open questions cần BA trả lời, thuật ngữ mới đề xuất.
   - KHÔNG commit. Để người review & merge.

## Nguyên tắc
- Không sửa `03-api/api-spec.md` (file sinh từ OpenAPI).
- Trung thực: phần nào thiếu dữ liệu thì ghi rõ là Open question.
- Token-tiết kiệm: link sang shared thay vì copy.
- Sau khi xong có thể gợi ý user chạy `doc-kit validate`.

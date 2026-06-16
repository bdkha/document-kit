---
name: ingest-feature
description: Kéo docs thô từ Notion + Figma vào một feature của Document Kit, dùng Notion MCP & Figma MCP có sẵn của Claude (không cần token CLI) + suy luận của model để map frame↔usecase/AC. Dùng khi user đưa link Notion/Figma và muốn nạp vào feature, hoặc nói "ingest feature X từ Notion này", "kéo tài liệu BA vào feature".
---

# Skill: ingest-feature

Nạp nguồn (Notion/Figma) vào `00-raw/` + `feature.yaml.figma[]` của một feature, **tận dụng MCP
kết nối sẵn của Claude** thay vì HTTP/token. Đây là đường intake "thông minh"; bản CLI
`doc-kit add-raw` là đường headless/CI tương đương.

## Điều kiện
- Có MCP **document-kit** (tool `list_features`, `submit_raw`, `add_figma_link`…).
- Có **Notion MCP** và/hoặc **Figma MCP** kết nối trong Claude Code.
- User cung cấp: feature id (hoặc tên để tạo mới) + link Notion/Figma.

## Quy trình

1. **Xác định feature**
   - `list_features` để tìm id. Nếu chưa có → đề xuất `doc-kit new "<tên>"` rồi tiếp tục.

2. **Đọc Notion bằng Notion MCP** (không cần `NOTION_API_KEY`)
   - `notion-fetch` trang được đưa; nếu trang trỏ tới trang con/khác liên quan, fetch tiếp.
   - `notion-search` nếu user chỉ mô tả mà chưa có link.
   - Chuyển nội dung thành markdown gọn (giữ heading, list, bảng, **giữ nguyên link inline**).

3. **Lưu raw vào kit**
   - Gọi `submit_raw(id, filename="notion-<slug>.md", content=<markdown>)`.
   - Vì Claude đã tự đọc nội dung, bước này không cần token Notion ở server.

4. **Trích + map Figma link (phần model làm tốt nhất)**
   - Quét nội dung tìm mọi URL Figma. Phân loại:
     - link **full-flow** cho cả feature, và/hoặc
     - link **frame riêng** đặt cạnh từng usecase / Acceptance Criteria.
   - Với mỗi link → `add_figma_link(id, url, name=<usecase/AC tương ứng>, nodeId=<từ node-id>)`.
     `name` nên ghi rõ ngữ cảnh (vd "AC-3: empty state", "Flow tổng") để giữ mapping.

5. **Phân tích Figma bằng Figma MCP**
   - Với frame quan trọng: `get_metadata` / `get_design_context` để hiểu cấu trúc + component,
     `get_variable_defs` cho design tokens, `get_screenshot` nếu cần ảnh tham chiếu.
   - Ghi nhận mapping frame ↔ usecase/AC để bước compile dùng.

6. **Báo cáo & bàn giao**
   - Tóm tắt: đã lưu raw nào, bao nhiêu Figma link + mapping, điểm chưa rõ (Open questions).
   - Gợi ý chạy skill `compile-feature` để sinh `01-business-spec.md` + `02-design-spec.md`.

## Nguyên tắc
- Ưu tiên MCP kết nối của Claude (Notion/Figma) — không yêu cầu token CLI.
- Trung thực mapping: chỉ gắn frame↔usecase khi nguồn nói rõ; còn lại đưa vào Open questions.
- Không sửa file sinh tự động (`03-api/api-spec.md`).
- Giữ nguyên ngữ cảnh link trong markdown để truy vết về sau.

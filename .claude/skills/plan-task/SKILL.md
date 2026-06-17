---
name: plan-task
description: Lập plan cho một task (feature mới HOẶC bảo trì) ở repo FE/BE từ Document Kit — đưa ticket number, kéo đúng "document change" cần làm rồi dựng plan theo delta. Dùng khi bắt đầu một ticket ở repo FE/BE. Trigger: "plan ticket ENG-123", "lập plan cho task này", "kéo context để làm ticket".
---

# Skill: plan-task

Ở repo FE/BE, khi nhận một ticket (feature mới hoặc bug fix/cải tiến), skill này kéo đúng phần
tài liệu cần làm từ Document Kit rồi dựng plan — **scope theo delta**, không đọc thừa.

## Xác định role
- `fe` nếu đang ở repo FE (web/RN), `be` nếu ở repo BE. Lấy từ env `DOC_KIT_ROLE` (đặt sẵn trong
  `.mcp.json`/`.env` của repo), hoặc truyền `role` khi gọi tool.

## Quy trình

1. **Tra theo ticket → gói plan đã scope** (1 lời gọi):
   - MCP: `plan_for_ticket(ticket="ENG-123", role="fe"|"be")`.
   - CLI: `doc-kit plan --ticket ENG-123 --role fe`.
   - Trả về: feature (id/title/status), **Δ các change của đúng ticket** (type, note, impact, docs bị đụng),
     và nội dung spec liên quan theo role (business + api-spec [+ design nếu fe]).

2. **Đọc kết quả đúng loại task**:
   - **Δ có change khớp (bảo trì)** → chỉ plan phần thay đổi: đọc các mục `docs` bị đụng + AC/endpoint
     liên quan. **Không** làm lại cả feature.
   - **Ticket feature mới** (`isNewFeature`) → plan từ toàn bộ context (AC + api-spec + design).

3. **(Tuỳ chọn) quét nhiều việc đang chờ role này**: `pending_changes(role)` (CLI `doc-kit pending --role`)
   để thấy mọi feature có delta chưa xử lý.

4. **Dựng plan**: map mỗi task ↔ AC (business-spec) ↔ endpoint (api-spec) ↔ screen/state (design-spec, chỉ FE).
   Với bảo trì, mỗi task gắn vào đúng change `rev`/ticket.

5. **Sau khi đã áp**: `ack_api_pull(id, role)` (CLI `doc-kit ack <id> --role`) để clear pending của role.

## Nguyên tắc
- Ticket → `plan_for_ticket` → plan. Đừng tự đọc lan man cả kit.
- Tôn trọng `impact`: nếu ticket không impact role của bạn, không có việc — đừng bịa task.
- Không sửa tài liệu kit ở đây; skill này chỉ **đọc để lập plan**. Sửa spec là việc của `maintain-feature`.

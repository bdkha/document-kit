# Tích hợp Document Kit vào repo FE/BE (đọc docs lúc planning)

Mục tiêu: khi skill planning của bạn chạy cho một feature, Claude **tự kéo context** (business +
api + design + tasks) từ Document Kit để lập plan đúng.

## 1. Add repo docs làm submodule

```bash
git submodule add <repo-docs-url> docs/kit
```

## 2. Cấu hình MCP cho repo FE/BE

Thêm vào `.mcp.json` ở **root repo FE/BE** (xem file `mcp.json` mẫu cạnh đây):

```json
{
  "mcpServers": {
    "document-kit": {
      "command": "npx",
      "args": ["-y", "-p", "@bdkha/document-kit", "doc-kit", "mcp"],
      "env": {
        "DOC_KIT_ROOT": "${workspaceFolder}/docs/kit",
        "DOC_KIT_ROLE": "fe"
      }
    }
  }
}
```

`DOC_KIT_ROOT` trỏ vào submodule → MCP đọc đúng docs. `DOC_KIT_ROLE` = `fe` ở repo FE, `be` ở repo BE
→ pending/plan chỉ trả delta ảnh hưởng tới vai đó.

## 3. Chèn "Bước 0: lấy context theo ticket" vào skill planning của bạn

Dán block sau vào đầu skill/slash-command planning hiện có (trước khi sinh plan). Hoạt động cho **cả
feature mới lẫn task bảo trì** (bug fix / cải tiến), cho **cả FE lẫn BE** (đổi `role`):

```markdown
## Bước 0 — Lấy context từ Document Kit (bắt buộc trước khi plan)

1. Có ticket (vd branch `ENG-123-...`) → gọi 1 lần:
   `plan_for_ticket(ticket="ENG-123", role="fe")`   # role="be" nếu ở repo BE
   (CLI: `doc-kit plan --ticket ENG-123 --role fe`)
   → trả về: feature + ĐÚNG Δ thay đổi của ticket (type/impact/docs bị đụng) + spec liên quan.
2. Đọc kết quả:
   - Nếu là **task bảo trì** (có Δ change khớp): chỉ plan phần thay đổi — đọc các mục `docs` bị đụng
     + AC/endpoint liên quan. KHÔNG làm lại cả feature.
   - Nếu là **feature mới** (isNewFeature): plan từ toàn bộ context (AC + api-spec + design).
3. (Tuỳ chọn) quét mọi việc đang chờ vai mình: `pending_changes(role)` (CLI `doc-kit pending --role fe`).
4. Lập plan: map mỗi task ↔ AC (business-spec) ↔ endpoint (api-spec) ↔ screen/state (design-spec, chỉ FE).
5. Sau khi áp xong: `ack_api_pull(id, role)` (CLI `doc-kit ack <id> --role fe`) để clear pending của vai.
```

> Không tìm thấy ticket trong kit? → ticket chưa được map vào feature nào; báo BA/maintainer dùng
> skill `maintain-feature` (hoặc `doc-kit new`) trước.

## 4. (Tuỳ chọn) cài skills của kit

Nếu muốn dùng luôn `ingest-feature` / `compile-feature` / `attach-api` / `maintain-feature` /
`plan-task` trong repo này:

```bash
npx -p @bdkha/document-kit doc-kit install-skills
```

## Tóm tắt MCP tool dùng khi planning
- `plan_for_ticket({ticket, role})` → gói plan đã scope (Δ change + spec liên quan). **Ưu tiên dùng.**
- `find_feature({ticket|query|status})` → tìm feature id.
- `pending_changes(role)` → feature có thay đổi mới ảnh hưởng vai mình (fe|be).
- `get_feature(id)` → trọn gói context (khi cần đọc đầy đủ).
- `ack_api_pull(id, role)` → xác nhận vai mình đã pull tới revision hiện tại.

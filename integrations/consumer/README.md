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
      "env": { "DOC_KIT_ROOT": "${workspaceFolder}/docs/kit" }
    }
  }
}
```

`DOC_KIT_ROOT` trỏ vào submodule → MCP đọc đúng docs của dự án.

## 3. Chèn "Bước 0: lấy context" vào skill planning của bạn

Dán block sau vào đầu skill/slash-command planning hiện có (trước khi sinh plan):

```markdown
## Bước 0 — Lấy context từ Document Kit (bắt buộc trước khi plan)

1. Xác định feature:
   - Nếu có ticket (vd branch `feature/ENG-123-...`): gọi MCP `find_feature(ticket="ENG-123")`.
   - Hoặc theo từ khoá: `find_feature(query="onboarding")`.
   - (CLI tương đương: `doc-kit find --ticket ENG-123`)
2. Kiểm tra API mới: `pending_changes()` — nếu feature nằm trong danh sách, đọc kỹ thay đổi.
3. Lấy trọn context: `get_feature(id)`  (CLI: `doc-kit context <id>`).
4. Lập plan dựa trên:
   - **Acceptance Criteria** (business-spec) làm tiêu chí "done".
   - **api-spec**: endpoint + request/response + data model → task tích hợp API.
   - **design-spec**: màn hình/frame + state (loading/empty/error) → task UI.
   - Map mỗi task ↔ AC ↔ endpoint ↔ screen.
5. Sau khi plan xong (đã áp bản API mới): `ack_api_pull(id)` để clear cờ pending.
```

> Nếu skill của bạn không dùng MCP mà shell ra lệnh, thay bằng:
> `doc-kit find --ticket <X>` → `doc-kit context <id>` → nhúng stdout vào ngữ cảnh plan.

## 4. (Tuỳ chọn) cài skills của kit

Nếu muốn dùng luôn `ingest-feature` / `compile-feature` / `attach-api` trong repo này:

```bash
npx -p @bdkha/document-kit doc-kit install-skills
```

## Tóm tắt MCP tool dùng khi planning
- `find_feature({ticket|query|status})` → tìm feature id.
- `pending_changes()` → feature nào có API mới hơn bản đã pull.
- `get_feature(id)` → trọn gói context.
- `ack_api_pull(id)` → xác nhận đã đọc bản API mới.

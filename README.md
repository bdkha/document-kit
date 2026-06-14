# Document Kit

Bộ kit lưu trữ tài liệu **dùng chung cho AI workflow** giữa FE và BE.

Một nơi duy nhất để: biến docs nghiệp vụ thô + Figma của BA thành spec mà AI đọc được,
để BE đẩy ngược API docs (OpenAPI), và để FE pull trọn context của một feature về làm task.

```
BA (docs thô + Figma) ──▶ [ DOCUMENT KIT ] ◀── BE (OpenAPI)
                                 │
                                 └──▶ FE pull context → AI làm task
```

## Thành phần

- **Git repo** (markdown/yaml): storage + source of truth, tổ chức theo feature.
- **MCP server** (`src/mcp`): lớp truy cập cho AI agent — đọc feature, search, push API.
- **CLI `doc-kit`** (`src/cli`): tạo feature, validate, push OpenAPI (chạy tay hoặc trong CI).
- **Skill `compile-feature`**: Claude biên dịch docs thô + Figma → spec, người review.

## Cấu trúc

```
features/<feature-id>/   # mỗi feature self-contained (xem AGENTS.md)
shared/                  # glossary, data-models, conventions dùng chung
templates/               # template cho từng loại doc
.doc-kit/                # schema + config
src/                     # MCP server + CLI (TypeScript)
.claude/skills/          # skill cho Claude Code
AGENTS.md                # hiến pháp cho AI agent — đọc trước
```

## Bắt đầu nhanh

```bash
npm install
npm run build

# Tạo feature mới
node dist/cli/index.js new "User Onboarding"

# BE đẩy OpenAPI lên (chạy tay)
node dist/cli/index.js push-api F-001-user-onboarding ./openapi.yaml

# BE đẩy trong CI (non-interactive)
node dist/cli/index.js push-api F-001-user-onboarding ./openapi.yaml --ci

# Validate toàn bộ kit
node dist/cli/index.js validate

# Chạy MCP server (local-first, đọc repo này)
node dist/mcp/index.js
```

### Cấu hình MCP cho Claude Code

Thêm vào `.mcp.json` của dự án FE/BE (trỏ tới bản clone kit):

```json
{
  "mcpServers": {
    "document-kit": {
      "command": "node",
      "args": ["/đường/dẫn/document-kit/dist/mcp/index.js"],
      "env": { "DOC_KIT_ROOT": "/đường/dẫn/document-kit" }
    }
  }
}
```

## Tiêu dùng từ dự án FE/BE

Add kit này làm **git submodule** để có bản versioned, offline:

```bash
git submodule add <repo-url> docs/kit
```

Rồi trỏ `DOC_KIT_ROOT` của MCP vào `docs/kit`.

## Lộ trình

- **MVP (hiện tại)**: scaffolding, templates, schema, skill compile, MCP read tools + push_api_doc, CLI.
- **Phase 2**: semantic search, remote MCP server dùng chung, web UI, webhook báo FE khi API đổi.

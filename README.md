# Document Kit

Bộ kit (npm package) lưu trữ tài liệu **dùng chung cho AI workflow** giữa FE và BE.

Một nơi duy nhất để: biến docs nghiệp vụ thô + Figma của BA thành spec mà AI đọc được,
để BE đẩy ngược API docs (OpenAPI), và để FE pull trọn context của một feature về làm task.

```
BA (docs thô + Figma) ──▶ [ DOCS REPO của dự án ] ◀── BE (OpenAPI)
                                  │
                                  └──▶ FE pull context → AI làm task
```

## Hai phần tách biệt

- **Tool** (package này, dùng chung mọi dự án): CLI `doc-kit` + MCP server + templates + schema.
- **Content** (repo docs riêng từng dự án): `features/`, `shared/`, `.doc-kit/config.yaml`, `.env`.

Tool cài/chạy qua npm; mỗi dự án có một repo docs riêng tạo bằng `doc-kit init`.

## Bắt đầu cho một dự án mới

```bash
# Tạo repo docs cho dự án (chạy trong thư mục repo docs trống)
npx -p @bdkha/document-kit doc-kit init
cp .env.example .env            # điền LINEAR_API_KEY, DOC_KIT_CONSUMER…

# Tạo feature
npx -p @bdkha/document-kit doc-kit new "User Onboarding"

# BA nạp docs thô: file local, link Notion (fetch nội dung + trích Figma), link Figma
npx -p @bdkha/document-kit doc-kit add-raw F-001-user-onboarding ./brief.pdf "https://notion.so/..."
npx -p @bdkha/document-kit doc-kit add-figma F-001-user-onboarding "https://figma.com/design/...node-id=1-23" --name "Onboarding flow"

# BE đẩy OpenAPI vào 1 feature (AI chọn paths/tags, kit cắt deterministic)
npx -p @bdkha/document-kit doc-kit push-api F-001-user-onboarding ./openapi.json --tags onboarding

# FE: xem API mới so với bản đã pull, rồi xác nhận
npx -p @bdkha/document-kit doc-kit pending
npx -p @bdkha/document-kit doc-kit ack F-001-user-onboarding

# Validate toàn bộ docs
npx -p @bdkha/document-kit doc-kit validate
```

## Cấu hình (per-project)

| Loại | Ở đâu | Ví dụ |
|---|---|---|
| Secret / per-machine / per-consumer | `.env` (gitignore) | `LINEAR_API_KEY`, `DOC_KIT_ROOT`, `DOC_KIT_STATE`, `DOC_KIT_CONSUMER` |
| Structural, commit được | `.doc-kit/config.yaml` | ticket url template, status flow, id prefix |

Thứ tự ưu tiên: **CLI flag > `.env` > `.doc-kit/config.yaml` > default**. Tool dò content root
qua `DOC_KIT_ROOT`, hoặc dò ngược từ cwd tìm `.doc-kit/config.yaml`.

## MCP cho Claude Code

`doc-kit init` đã tạo sẵn `.mcp.json` trỏ MCP vào repo docs đó:

```json
{
  "mcpServers": {
    "document-kit": {
      "command": "npx",
      "args": ["-y", "-p", "@bdkha/document-kit", "doc-kit", "mcp"],
      "env": { "DOC_KIT_ROOT": "${workspaceFolder}" }
    }
  }
}
```

## Tiêu dùng từ repo FE/BE

Add repo docs của dự án làm submodule để đọc offline, versioned:

```bash
git submodule add <repo-docs-url> docs/kit
```

## Phát triển tool này

```bash
npm install
npm run build
# Chạy lệnh trên content mẫu:
DOC_KIT_ROOT=examples/sample-docs node dist/cli/index.js list
```

- `src/` — CLI + MCP + lib (TypeScript, ESM).
- `templates/`, `scaffold/`, `.doc-kit/schema/` — asset shipped trong package.
- `examples/sample-docs/` — content mẫu để dev/test (không publish).
- `integrations/nestjs/` — script export OpenAPI + workflow CI mẫu.
- `.claude/skills/` — skill `compile-feature`, `attach-api`.

## Publish (CI tự động)

`.github/workflows/publish.yml` tự publish lên npm khi push/merge vào `main`, nhưng **chỉ khi
version trong `package.json` chưa có trên npm**. Quy trình:

1. Bump `version` trong `package.json` (vd `npm version patch`), commit/merge vào `main`.
2. CI build + validate + check version → `npm publish --provenance --access public` → tạo tag `vX.Y.Z`.
3. Nếu version chưa đổi, CI skip publish (không lỗi).

Cần secret repo **`NPM_TOKEN`** (npm automation token có quyền publish).

## Lộ trình

- **MVP**: scaffolding, templates, schema, skill compile, MCP read tools + push_api_doc, CLI.
- **Phase 2A**: AI-driven OpenAPI slicing + NestJS integration.
- **Phase 2B**: notify FE (PULL pending/ack + Linear push tuỳ chọn).
- **Phase 3 (hiện tại)**: đóng gói npm + `doc-kit init` + config qua `.env`.
- **Tiếp theo**: semantic search, remote MCP server dùng chung.

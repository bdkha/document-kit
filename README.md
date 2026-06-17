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

## Luồng theo vai trò trong Claude Code

Cài skills một lần để dùng slash command ở mọi repo:
`npx -p @bdkha/document-kit doc-kit install-skills --global`

Một feature đi qua 3 vai trò theo vòng: **BA → BE → FE** (và lặp lại khi API/đổi nghiệp vụ).

### 🧩 BA — biến nghiệp vụ thô + Figma thành spec

| # | Làm gì | Trong Claude Code |
|---|--------|-------------------|
| 1 | Tạo feature | "Tạo feature User Onboarding" → `doc-kit new` (id `F-001-...`) |
| 2 | Nạp nguồn | **`/ingest-feature`** đưa link Notion + Figma → Claude đọc qua Notion/Figma MCP, lưu `00-raw/`, map Figma frame ↔ usecase/AC |
| 3 | Biên dịch spec | **`/compile-feature`** → sinh `01-business-spec.md` + `02-design-spec.md` (BA review) |
| 4 | Chốt | Sửa Open questions, đặt `status: in-design`, commit/PR repo docs |

→ Đầu ra: business-spec (Goal, User Stories, **Acceptance Criteria**, Business Rules) + design-spec.

### ⚙️ BE Dev — code API rồi đẩy ngược lên kit

| # | Làm gì | Trong Claude Code |
|---|--------|-------------------|
| 1 | Planning | Skill planning gọi `find_feature(ticket)` → `get_feature(id)` → đọc business-spec để plan API theo AC |
| 2 | Code | Hiện thực endpoint (NestJS…) |
| 3 | Export OpenAPI | `scripts/export-openapi.ts` (xem `integrations/nestjs/`) → `openapi.json` |
| 4 | Gắn API vào feature | **`/attach-api`**: chọn `--tags`/`--paths` thuộc feature → `push_api_doc` → kit sinh `api-spec.md`, bump `api.version`, set `needs_fe_repull`, `status: in-dev` |
| 5 | Báo FE | `doc-kit notify <id>` (báo vào ticket Linear/Redmine của feature) — hoặc để CI tự làm |

→ Đầu ra: `03-api/openapi.yaml` (nguồn) + `api-spec.md` (AI-friendly) gắn đúng feature.

### 💻 FE Dev — pull context, làm task RN/Next

| # | Làm gì | Trong Claude Code |
|---|--------|-------------------|
| 1 | Xem API có đổi | `pending_changes()` (CLI: `doc-kit pending`) |
| 2 | Planning | `find_feature(ticket)` → `get_feature(id)` → plan theo **AC + api-spec + design-spec** |
| 3 | Code | Làm UI/màn hình, ghép API theo `api-spec`, state loading/empty/error theo `design-spec` |
| 4 | Xác nhận đã pull | `ack_api_pull(id)` (CLI: `doc-kit ack <id>`) để clear cờ pending |

→ Mỗi task tự đủ ngữ cảnh: AC nào, endpoint nào, screen nào.

> Cách nối Bước-0 vào skill planning có sẵn của bạn: xem [`integrations/consumer/`](integrations/consumer/README.md).

## Cấu hình (per-project)

| Loại | Ỡ đâu | Ví dụ |
|---|---|---|
| Secret / per-machine / per-consumer | `.env` (gitignore) | `LINEAR_API_KEY`, `REDMINE_URL` + `REDMINE_API_KEY`, `DOC_KIT_ROOT`, `DOC_KIT_STATE`, `DOC_KIT_CONSUMER` |
| Structural, commit được | `.doc-kit/config.yaml` | ticket url template, status flow, id prefix |

### Ticket systems

`tickets[].system` hỗ trợ `linear | jira | github | redmine | none`. Lệnh `doc-kit notify`
báo "API đã đổi" vào **mọi** ticket mà feature gắn:

- **Linear** — cần `LINEAR_API_KEY` (comment qua GraphQL API).
- **Redmine** (thường **self-host**) — cần `REDMINE_URL` (gốc instance, vd
  `https://redmine.cong-ty.vn`) + `REDMINE_API_KEY` (My account → API access key).
  Notify thêm note vào issue qua REST `PUT /issues/{id}.json`. Id là số (`1234` hoặc `#1234`).

Thiếu env hay feature không gắn ticket tương ứng → skip (không lỗi), CI vẫn xanh.

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

## Skills cho Claude Code (dùng MCP Notion/Figma + suy luận)

Kit kèm 3 skill, tận dụng MCP kết nối sẵn của Claude (không cần token CLI):

- **`ingest-feature`** — kéo docs từ Notion + Figma vào feature (Notion MCP đọc nội dung,
  Figma MCP phân tích frame, model map frame↔usecase/AC).
- **`compile-feature`** — biên dịch 00-raw + Figma → business/design spec.
- **`attach-api`** — BE gắn OpenAPI vào đúng feature.

Claude Code chỉ tự nạp skills ở **project root**, không nạp trong submodule. Cài để dùng ở bất kỳ repo:

```bash
# Trong repo docs / FE / BE:
npx -p @bdkha/document-kit doc-kit install-skills          # -> ./.claude/skills
npx -p @bdkha/document-kit doc-kit install-skills --global # -> ~/.claude/skills (mọi project)
```

Rồi trong Claude Code gõ `/ingest-feature`, `/compile-feature`, `/attach-api`.

## Tiêu dùng từ repo FE/BE (đọc docs lúc planning)

Add repo docs của dự án làm submodule, trỏ MCP vào đó, rồi cho skill planning kéo context:

```bash
git submodule add <repo-docs-url> docs/kit
```

`.mcp.json` ở root repo FE/BE trỏ `DOC_KIT_ROOT=${workspaceFolder}/docs/kit`. Skill planning
gọi `find_feature(ticket)` → `get_feature(id)` để lập plan theo AC + api-spec + design-spec.
Chi tiết + block dán vào skill planning: xem [`integrations/consumer/`](integrations/consumer/README.md).

Lệnh hỗ trợ planning:
- `doc-kit find --ticket ENG-123` — map ticket/branch → feature id.
- `doc-kit context <id>` — in trọn gói context để nhúng vào plan.

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

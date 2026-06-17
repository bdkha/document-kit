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
| 1 | Planning | **`/plan-task`**: `plan_for_ticket(ticket, role="be")` → đọc business-spec để plan API theo AC (chỉ Δ nếu là bảo trì) |
| 2 | Code | Hiện thực endpoint (NestJS…) |
| 3 | Export OpenAPI | `scripts/export-openapi.ts` (xem `integrations/nestjs/`) → `openapi.json` |
| 4 | Gắn API vào feature | **`/attach-api`**: chọn `--tags`/`--paths` thuộc feature → `push_api_doc` → kit sinh `api-spec.md`, bump `api.version` + `feature.version`, ghi `changes[]` (impact mặc định `[fe]`), `status: in-dev` |
| 5 | Báo FE | `doc-kit notify <id>` (báo vào ticket Linear/Redmine của feature) — hoặc để CI tự làm |

→ Đầu ra: `03-api/openapi.yaml` (nguồn) + `api-spec.md` (AI-friendly) gắn đúng feature.

### 💻 FE Dev — pull context, làm task RN/Next

| # | Làm gì | Trong Claude Code |
|---|--------|-------------------|
| 1 | Planning theo ticket | **`/plan-task`**: `plan_for_ticket(ticket, role="fe")` → feature + Δ thay đổi + **AC + api-spec + design-spec** |
| 2 | Xem việc đang chờ | `pending_changes(role="fe")` (CLI: `doc-kit pending --role fe`) |
| 3 | Code | Làm UI/màn hình, ghép API theo `api-spec`, state loading/empty/error theo `design-spec` |
| 4 | Xác nhận đã pull | `ack_api_pull(id, role="fe")` (CLI: `doc-kit ack <id> --role fe`) để clear pending của vai |

→ Mỗi task tự đủ ngữ cảnh: AC nào, endpoint nào, screen nào.

### 🔧 Bảo trì — bug fix / cải tiến trên feature đã có

Agile: feature `done` rồi vẫn có task sửa bug / cải tiến nhỏ — **không** tạo feature mới. Mỗi thay đổi ghi
`impact: [fe|be]` → **cả FE lẫn BE** đều được báo đúng phần việc của mình (không chỉ FE).

| # | Làm gì | Trong Claude Code |
|---|--------|-------------------|
| 1 | Map ticket → feature | `find_feature(ticket)` (CLI: `doc-kit find --ticket …`) |
| 2 | Sửa spec tại chỗ | **`/maintain-feature`**: chỉnh đúng phần đổi trong `01`/`02` (giữ template) |
| 3 | Ghi nhận | `log_change(id, type, note, ticket?, impact, docs?)` (CLI: `doc-kit log-change … --impact fe,be`) → bump `feature.version`, ghi `changes[]` (rev + impact) + CHANGELOG, gắn ticket. **Status giữ nguyên** |
| 4 | Đụng API? | Dùng **`/attach-api`** → `push_api_doc` (bump api.version + feature.version, ghi `changes[]`) |

→ Đầu ra: spec được vá đúng phạm vi + `changes[]` (impact) + CHANGELOG. FE & BE bị impact tự thấy delta qua
`pending_changes(role)` / `plan_for_ticket`.

> Cách nối Bước-0 (planning theo ticket, role-aware) vào skill có sẵn: xem [`integrations/consumer/`](integrations/consumer/README.md).

## Ví dụ & tham chiếu lệnh

> Các ví dụ giả định bạn **đứng trong repo docs** nên gọi `doc-kit` trực tiếp (thực tế dùng
> `npx -p @bdkha/document-kit doc-kit …`). Content root (chỗ chứa `features/`) tự dò từ cwd; khi chạy
> từ nơi khác (vd MCP) set `DOC_KIT_ROOT=/đường/dẫn/repo-docs`.

**Feature mới (end-to-end):**

```bash
doc-kit init && cp .env.example .env        # khởi tạo repo docs 1 lần
doc-kit new "User Onboarding"               # → features/F-001-user-onboarding/
doc-kit add-raw   F-001-user-onboarding ./brief.pdf "https://www.notion.so/..."
doc-kit add-figma F-001-user-onboarding "https://figma.com/design/...?node-id=1-23" --name "Onboarding flow"
# /compile-feature trong Claude Code → sinh 01-business-spec.md + 02-design-spec.md (BA review)
doc-kit push-api F-001-user-onboarding ./openapi.json --tags onboarding --note "Khởi tạo API"
doc-kit plan    --ticket ENG-101 --role fe  # FE lập plan → code
doc-kit ack     F-001-user-onboarding --role fe
```

**Bảo trì (bug fix / cải tiến) trên feature đã `done`** — không tạo feature mới, status giữ nguyên:

```bash
# Đổi business rule/AC → impact CẢ fe,be (BE cũng phải sửa API/logic)
doc-kit log-change F-001-user-onboarding --type bugfix \
  --note "Sửa rule validate email cho đúng AC-2" --ticket ENG-220 --impact fe,be --docs 01-business-spec.md#br-1
# Cải tiến chỉ đụng UI → impact fe (BE sẽ KHÔNG thấy pending)
doc-kit log-change F-001-user-onboarding --type improvement --note "Gợi ý mật khẩu mạnh" --impact fe
# Thay đổi ĐỤNG API → dùng push-api (đừng log-change); nó tự ghi changes type=api
doc-kit push-api F-001-user-onboarding ./openapi.json --tags onboarding --impact fe,be --ticket ENG-220
```

**Lập plan từ ticket (FE & BE)** — bảo trì chỉ trả Δ thay đổi của ticket; ticket feature mới trả full context:

```bash
doc-kit plan --ticket ENG-220 --role be    # BE: business(AC/BR) + api-spec + Δ change
doc-kit plan --ticket ENG-220 --role fe    # FE: thêm design-spec
doc-kit pending --role be                  # quét mọi feature có change ảnh hưởng vai be
```

Output (rút gọn) của `plan --role be`:

```
# Plan context cho ticket ENG-220 (role: be)
Feature: F-001-user-onboarding — User Onboarding [done]
## Δ Cần làm (đúng thay đổi của ticket — chỉ plan phần này)
- rev 3 [bugfix] — Sửa rule validate email cho đúng AC-2  (impact: fe+be)
  docs: 01-business-spec.md#br-1
--- ## BUSINESS SPEC … --- ## API SPEC …
```

### Tham chiếu CLI đầy đủ

| Lệnh | Mục đích | Cờ chính |
|---|---|---|
| `doc-kit init [dir]` | Khởi tạo repo docs | |
| `doc-kit new "<Tên>"` | Tạo feature từ template | |
| `doc-kit add-raw <id> <path\|url…>` | Nạp docs thô vào `00-raw/` | `--no-figma` |
| `doc-kit add-figma <id> <url>` | Thêm Figma link vào `feature.yaml` | `--name`, `--node` |
| `doc-kit push-api <id> <openapi>` | Đẩy OpenAPI, sinh `api-spec.md` | `--tags`, `--paths`, `--note`, `--impact`, `--ticket` |
| `doc-kit log-change <id>` | Ghi thay đổi bảo trì | `--type`, `--note`, `--ticket`, `--impact`, `--docs` |
| `doc-kit plan` | Gói plan đã scope theo ticket | `--ticket` (bắt buộc), `--role` |
| `doc-kit pending` | Feature có thay đổi ảnh hưởng vai | `--role`, `--state` |
| `doc-kit ack <id>` | Xác nhận đã pull tới rev hiện tại | `--role`, `--state` |
| `doc-kit find` | Tìm feature | `--ticket`, `--query`, `--status` |
| `doc-kit list [status]` | Liệt kê feature | |
| `doc-kit context <id>` | In trọn gói context | |
| `doc-kit notify <id>` | Báo ticket (Linear/Redmine) | `--note` |
| `doc-kit validate` | Validate toàn bộ kit | |
| `doc-kit install-skills [dir]` | Cài skills cho Claude Code | `--global` |
| `doc-kit mcp` | Chạy MCP server (stdio) | |

Mọi lệnh đọc/ghi đều nhận `--ci` để in JSON (cho agent/CI), exit code `!=0` khi lỗi.

### Tham chiếu MCP tool

Gọi trực tiếp trong Claude Code khi đã trỏ MCP vào repo docs:

| Tool | Tương đương CLI |
|---|---|
| `list_features(status?)` | `doc-kit list` |
| `find_feature({ticket\|query\|status})` | `doc-kit find` |
| `get_feature(id)` | `doc-kit context` |
| `get_business_spec / get_design_spec / get_api_spec (id)` | — (đọc từng doc) |
| `get_shared_doc(name)` | — (glossary/data-models/conventions) |
| `search_docs(query)` | — (full-text trong mọi feature) |
| `plan_for_ticket(ticket, role?)` | `doc-kit plan --ticket --role` |
| `pending_changes(role?)` | `doc-kit pending --role` |
| `ack_api_pull(id, role?)` | `doc-kit ack --role` |
| `push_api_doc(id, openapi, paths?, tags?, note?, impact?, ticket?)` | `doc-kit push-api` |
| `log_change(id, type, note, ticket?, impact?, docs?)` | `doc-kit log-change` |
| `add_figma_link / add_raw_url / submit_raw` | `doc-kit add-figma / add-raw` |

### Mô hình dữ liệu cần nhớ

- **`feature.version` = revision**: số đếm tăng dần, bump bởi **cả** `push-api` lẫn `log-change`.
  `api.version` là version riêng của OpenAPI/`api-spec.md`.
- **`feature.yaml.changes[]`** (máy đọc) — nguồn để suy ra pending/plan. Mỗi entry:
  `{ rev, date, type, note, tickets[], impact:[fe|be], docs[] }`. `CHANGELOG.md` là bản người-đọc.
- **`impact`** quyết định **ai** cần hành động. Đổi business rule/AC → thường `[fe, be]`.
- **role** (`fe|be`, qua `DOC_KIT_ROLE` hoặc cờ `--role`): pending/plan chỉ trả phần ảnh hưởng vai đó.
- **pending** = có change `rev > revision đã ack` **và** `role ∈ change.impact`. **ack** lưu theo role.
- **status** `draft → in-design → in-dev → ready → done`: task bảo trì **không** đổi status.

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

Kit kèm 5 skill, tận dụng MCP kết nối sẵn của Claude (không cần token CLI):

- **`ingest-feature`** — kéo docs từ Notion + Figma vào feature (Notion MCP đọc nội dung,
  Figma MCP phân tích frame, model map frame↔usecase/AC).
- **`compile-feature`** — biên dịch 00-raw + Figma → business/design spec.
- **`attach-api`** — BE gắn OpenAPI vào đúng feature.
- **`maintain-feature`** — bug fix / cải tiến trên feature đã có: sửa spec tại chỗ +
  `log_change` (bump version + `changes[]` có impact, giữ status).
- **`plan-task`** — ở repo FE/BE: ticket → `plan_for_ticket(role)` → dựng plan theo delta (feature mới
  hoặc bảo trì).

Claude Code chỉ tự nạp skills ở **project root**, không nạp trong submodule. Cài để dùng ở bất kỳ repo:

```bash
# Trong repo docs / FE / BE:
npx -p @bdkha/document-kit doc-kit install-skills          # -> ./.claude/skills
npx -p @bdkha/document-kit doc-kit install-skills --global # -> ~/.claude/skills (mọi project)
```

Rồi trong Claude Code gõ `/ingest-feature`, `/compile-feature`, `/attach-api`, `/maintain-feature`, `/plan-task`.

## Tiêu dùng từ repo FE/BE (lập plan theo ticket)

Add repo docs của dự án làm submodule, trỏ MCP vào đó, rồi cho skill planning kéo context:

```bash
git submodule add <repo-docs-url> docs/kit
```

`.mcp.json` ở root repo FE/BE trỏ `DOC_KIT_ROOT=${workspaceFolder}/docs/kit` + `DOC_KIT_ROLE=fe|be`.
Skill planning gọi **`plan_for_ticket(ticket, role)`** → feature + Δ thay đổi của ticket + spec liên quan
để lập plan (scope theo delta cho cả task mới lẫn bảo trì). Lệnh CLI tương đương: xem [bảng tham
chiếu](#tham-chiếu-cli-đầy-đủ). Chi tiết block dán vào skill: xem
[`integrations/consumer/`](integrations/consumer/README.md).

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
- `.claude/skills/` — skill `ingest-feature`, `compile-feature`, `attach-api`, `maintain-feature`, `plan-task`.

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

# Docs — <Tên dự án>

Repo tài liệu dùng chung cho AI workflow (FE + BE) của dự án này, dựng bằng
[Document Kit](https://www.npmjs.com/package/@bdkha/document-kit).

## Cấu trúc

```
features/<id>/   mỗi feature self-contained (xem AGENTS.md)
shared/          glossary, data-models, conventions dùng chung
.doc-kit/        config.yaml (structural, commit được)
.env             secret/per-consumer (KHÔNG commit) — copy từ .env.example
```

## Dùng

```bash
cp .env.example .env          # rồi điền LINEAR_API_KEY, DOC_KIT_CONSUMER…

# Tạo feature (tool lấy từ npx, không cần cài)
npx -p @bdkha/document-kit doc-kit new "Tên feature"

# BE đẩy API vào 1 feature
npx -p @bdkha/document-kit doc-kit push-api F-001-... openapi.json --tags ...

# Bảo trì: ghi bug fix / cải tiến lên feature đã có (giữ status, bump version)
npx -p @bdkha/document-kit doc-kit log-change F-001-... --type bugfix --note "..." --ticket ENG-9

# FE xem API mới / xác nhận đã pull
npx -p @bdkha/document-kit doc-kit pending
npx -p @bdkha/document-kit doc-kit ack F-001-...

# Validate
npx -p @bdkha/document-kit doc-kit validate
```

MCP cho Claude Code đã cấu hình sẵn ở `.mcp.json` (trỏ vào chính repo này).

## Tiêu dùng từ repo FE/BE

Add repo docs này làm submodule:

```bash
git submodule add <repo-docs-url> docs/kit
```

Xem `AGENTS.md` để biết quy ước cho AI agent.

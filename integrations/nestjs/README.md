# Tích hợp NestJS → Document Kit

Đóng vòng **BE → repo docs**: BE xuất OpenAPI, gắn API vào đúng feature, đẩy ngược vào repo docs.

Tool dùng qua **npx** (`@bdkha/document-kit`); content nằm ở **repo docs riêng của dự án**.
Mapping endpoint → feature **do AI/người quyết định lúc push** (tool cắt deterministic theo
`--paths`/`--tags` và kéo theo `$ref`). `@ApiTags` chỉ là tín hiệu phụ, không bắt buộc —
nhờ vậy BE ngôn ngữ khác (Go/Java/.NET) cũng dùng được, miễn xuất ra OpenAPI 3.x.

## 1. Read path — add repo docs làm submodule

```bash
git submodule add <repo-docs-url> docs/kit
```

`docs/kit` chứa `features/`, `shared/`, `.mcp.json` (MCP trỏ sẵn vào đó).

## 2. Export OpenAPI từ NestJS

Copy `export-openapi.ts` vào `scripts/` của BE, sửa import `AppModule`, rồi:

```bash
npx ts-node scripts/export-openapi.ts openapi.json
```

Script tạo app context (`NestFactory.create`) **không** `listen`, build document bằng
`@nestjs/swagger`, ghi ra file.

## 3. Gắn API vào feature (đẩy vào kit)

Để **AI agent BE** làm khi đang có context (khuyến nghị) — qua MCP `push_api_doc`:

```
push_api_doc(id="F-001-user-onboarding", openapi=<nội dung>, tags=["onboarding"])
```

Hoặc thủ công bằng CLI (`DOC_KIT_ROOT` trỏ vào repo docs):

```bash
export DOC_KIT_ROOT=docs/kit   # hoặc chạy lệnh từ trong repo docs

# Cắt theo tag
npx -p @bdkha/document-kit doc-kit push-api F-001-user-onboarding openapi.json --tags onboarding

# Cắt theo path glob (* = 1 segment, ** = nhiều segment)
npx -p @bdkha/document-kit doc-kit push-api F-002-wallet openapi.json --paths "/wallet/**"

# Không filter = nguyên spec (case 1 service = 1 feature)
npx -p @bdkha/document-kit doc-kit push-api F-010-payments openapi.json
```

Tool sẽ: ghi `03-api/openapi.yaml`, sinh `api-spec.md`, bump `api.version`,
set `needs_fe_repull=true`, ghi CHANGELOG.

## 4. Tự động qua CI

Xem `github-workflow.yml` — workflow mẫu phía BE: export → push-api → **mở PR vào repo docs**
của dự án. Cần secrets `DOCS_REPO`, `DOCS_PUSH_TOKEN`, và `LINEAR_API_KEY` (tuỳ chọn).

## Khuyến nghị mapping
- Nếu kiểm soát được code BE: gắn `@ApiTags('<feature-id hoặc nhóm>')` để `--tags` gọn.
- Nếu không: dùng `--paths` glob, hoặc để AI agent chọn path/tag theo context task.

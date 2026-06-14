# Tích hợp NestJS → Document Kit

Đóng vòng **BE → kit**: BE xuất OpenAPI, gắn API vào đúng feature, đẩy ngược vào kit.

Mapping endpoint → feature **do AI/người quyết định lúc push** (kit cắt deterministic theo
`--paths`/`--tags` và kéo theo `$ref`). `@ApiTags` chỉ là tín hiệu phụ, không bắt buộc —
nhờ vậy BE ngôn ngữ khác (Go/Java/.NET) cũng dùng được, miễn xuất ra OpenAPI 3.x.

## 1. Read path — add kit làm submodule

```bash
git submodule add <kit-repo-url> docs/kit
cd docs/kit && npm ci && npm run build
```

Trỏ MCP của Claude Code vào submodule (xem README gốc của kit).

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

Hoặc thủ công bằng CLI:

```bash
# Cắt theo tag
node docs/kit/dist/cli/index.js push-api F-001-user-onboarding openapi.json --tags onboarding

# Cắt theo path glob (* = 1 segment, ** = nhiều segment)
node docs/kit/dist/cli/index.js push-api F-002-wallet openapi.json --paths "/wallet/**"

# Không filter = nguyên spec (case 1 service = 1 feature)
node docs/kit/dist/cli/index.js push-api F-010-payments openapi.json
```

Kit sẽ: ghi `03-api/openapi.yaml`, sinh `api-spec.md`, bump `api.version`,
set `needs_fe_repull=true`, ghi CHANGELOG.

## 4. Tự động qua CI

Xem `github-workflow.yml` — workflow mẫu phía BE: export → push-api → **mở PR vào kit repo**
(write path đi qua PR vì submodule chỉ đọc). Cần secrets `KIT_REPO` và `KIT_PUSH_TOKEN`.

## Khuyến nghị mapping
- Nếu kiểm soát được code BE: gắn `@ApiTags('<feature-id hoặc nhóm>')` để `--tags` gọn.
- Nếu không: dùng `--paths` glob, hoặc để AI agent chọn path/tag theo context task.

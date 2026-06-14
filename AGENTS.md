# AGENTS.md — Hướng dẫn cho AI agent dùng Document Kit

> File này là "hiến pháp" cho mọi AI agent (Claude Code, Cursor, …) khi đọc/ghi kit này.
> Đọc file này **trước** khi thao tác với bất kỳ feature nào.

## Kit này là gì

Document Kit là **single source of truth** dạng tài liệu, tổ chức theo *feature*, làm cầu nối:

```
BA (docs thô + Figma) ──①──▶ [ KIT ] ◀──②── BE (OpenAPI)
                                  │
                                  └──③──▶ FE pull context để làm task
```

- ① Claude biên dịch docs thô + Figma → `business-spec` + `design-spec` (người review).
- ② BE export OpenAPI → kit sinh `api-spec` AI-friendly.
- ③ FE lấy trọn context 1 feature → làm task RN / Next.

## Đơn vị trung tâm: feature

Mỗi feature là 1 thư mục trong `features/<feature-id>/`, **self-contained** — lấy đúng thư mục đó là đủ ngữ cảnh.

```
features/<feature-id>/
├── feature.yaml          # metadata (nguồn sự thật về trạng thái feature)
├── 00-raw/               # docs thô BA + Figma link (inbox, chưa biên dịch)
├── 01-business-spec.md   # nghiệp vụ AI-readable
├── 02-design-spec.md     # mô tả Figma + design tokens
├── 03-api/
│   ├── openapi.yaml      # BE đẩy lên — SOURCE OF TRUTH cho API
│   └── api-spec.md       # bản AI-friendly (SINH RA, không sửa tay)
├── 04-fe-tasks.md        # task FE: ghép business + api + design
└── CHANGELOG.md
```

## Quy tắc bắt buộc cho agent

1. **Không sửa file sinh ra bằng máy.** `03-api/api-spec.md` được sinh từ `openapi.yaml`. Muốn đổi → sửa nguồn rồi chạy lại generator.
2. **Tôn trọng template.** Khi tạo/điền doc, giữ đúng heading trong `templates/`. Heading cố định để agent khác parse được.
3. **Frontmatter là bắt buộc.** Mọi doc có YAML frontmatter (`feature`, `doc`, `version`, `status`, `updated_at`).
4. **Link, đừng lặp.** Thuật ngữ → `shared/glossary.md`; entity dùng chung → `shared/data-models.md`; quy ước → `shared/conventions.md`. Tham chiếu thay vì copy.
5. **Đánh dấu chỗ chưa chắc.** Điều gì suy luận/giả định → ghi vào mục "Open questions", đừng bịa thành sự thật.
6. **Bump version + ghi CHANGELOG** khi thay đổi nội dung có ý nghĩa.

## Đọc context thế nào (FE)

Ưu tiên qua MCP: `get_feature(id)` trả trọn gói. Nếu đọc file trực tiếp, thứ tự khuyến nghị:
`feature.yaml` → `01-business-spec.md` → `03-api/api-spec.md` → `02-design-spec.md` → `04-fe-tasks.md`.

## Gắn API → feature (cho BE agent)

Một OpenAPI của BE thường gồm nhiều feature. **AI quyết định mapping lúc push** (nơi AI có
context "API nào thuộc feature nào"); kit cắt deterministic và kéo theo `$ref`:

- Qua MCP `push_api_doc(id, openapi, paths?, tags?)` hoặc CLI `doc-kit push-api … --paths/--tags`.
- `tags` = tag OpenAPI (vd từ `@ApiTags`), `paths` = glob (`*`=1 segment, `**`=nhiều).
- Bỏ trống selector = lấy nguyên spec (1 service = 1 feature).
- Đừng tự cắt JSON tay — để kit cắt để không rớt schema. Xem skill `attach-api`.

## Trạng thái feature (`status`)

`draft` → `in-design` → `in-dev` → `ready` → `done`

FE chỉ nên bắt đầu task khi `status >= in-dev` và `api.version >= 1`.

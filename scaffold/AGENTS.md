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

## Revision, impact & pull theo role

- `feature.version` = **revision** đếm tăng dần, bump bởi **cả** `push_api_doc` lẫn `log_change`.
  `api.version` chỉ là version của OpenAPI/api-spec.
- Mỗi thay đổi ghi vào `feature.yaml.changes[]` (máy đọc) kèm **`impact: [fe|be]`** = vai cần hành
  động. CHANGELOG.md là bản người-đọc. Đổi business rule/AC thường impact **cả fe và be**.
- Mỗi consumer có **role** (`fe|be`, đặt qua `DOC_KIT_ROLE`) và nhớ đã pull tới revision mấy.
  Pending suy ra từ `changes[]`: có `rev > đã-ack` mà `role ∈ impact`.

## Đọc context / lập plan (FE & BE)

Ưu tiên 1 lời gọi theo ticket: **`plan_for_ticket(ticket, role)`** (CLI `doc-kit plan --ticket … --role …`)
→ trả feature + đúng Δ change của ticket + spec liên quan để dựng plan. Xem skill `plan-task`.

**Trước khi bắt đầu task**: `pending_changes(role)` (CLI `doc-kit pending --role fe|be`) để biết có delta
ảnh hưởng role mình không. Sau khi áp xong: `ack_api_pull(id, role)` (CLI `doc-kit ack <id> --role`) để
clear pending của role. State pull lưu riêng theo consumer (RN, Next, BE…), không nằm trong kit chung.

Nếu đọc file trực tiếp, thứ tự khuyến nghị:
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

## Bảo trì (bug fix / cải tiến)

Dự án chạy Agile: feature `done` rồi vẫn liên tục có task **bug fix / cải tiến** — *không phải*
feature mới, nên **không** tạo feature mới và **không** chạy lại ingest/compile từ đầu. Vòng lặp:

1. **Map ticket → feature**: `find_feature(ticket | query)`. Không có feature tương ứng (code cũ
   chưa doc) → đề xuất tạo feature tối thiểu (`doc-kit new`) hoặc gắn vào feature catch-all; hỏi
   reviewer, đừng bịa.
2. **Sửa spec tại chỗ**: chỉnh `01-business-spec.md` / `02-design-spec.md` đúng phần đổi (BR-/AC-,
   state…), giữ nguyên heading template. Chỗ chưa chắc → "Open questions".
3. **Đụng API?** → dùng `push_api_doc` như cũ (bump api.version + feature.version + `changes[]`).
   **Không** sửa `03-api/api-spec.md` bằng tay.
4. **Ghi nhận thay đổi**: `log_change(id, type, note, ticket?, impact, docs?)` (hoặc `doc-kit log-change`).
   Bump **`feature.version`**, ghi `changes[]` (rev + **impact**) + CHANGELOG có phân loại, gắn ticket
   vào `tickets[]`. **Status giữ nguyên** — feature `done` vẫn `done`.
5. **Đặt `impact` cho đúng** — đổi business rule/AC thường `[fe, be]` (BE cũng phải sửa API/logic, không chỉ
   FE). FE & BE tự thấy delta qua `pending_changes(role)` / `plan_for_ticket`.
6. Thêm task vào `04-fe-tasks.md` (nếu impact fe) với `Loại=bugfix/improvement`, tham chiếu AC + CHANGELOG.
   BE lập plan ở repo BE qua `plan_for_ticket(ticket, role=be)`.

Xem skill `maintain-feature`. Nguyên tắc: thay đổi có ý nghĩa = **bump version + ghi CHANGELOG**.

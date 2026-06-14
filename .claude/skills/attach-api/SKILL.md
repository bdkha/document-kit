---
name: attach-api
description: Gắn API (OpenAPI) vừa build ở BE vào đúng feature trong Document Kit. Dùng khi BE agent vừa tạo/sửa endpoint và cần đẩy ngược API docs lên kit cho FE. Hỗ trợ mọi BE (NestJS/Go/Java/.NET) miễn xuất được OpenAPI 3.x. Trigger: "đẩy API lên kit", "push api docs", "gắn endpoint này vào feature".
---

# Skill: attach-api

Bạn (AI agent ở BE) vừa build/đổi endpoint và đang có **context API nào thuộc feature nào** —
đây là lúc tốt nhất để gắn API vào kit. Mapping do **bạn** quyết định; kit cắt deterministic.

## Quy trình

1. **Có OpenAPI 3.x của service**
   - NestJS: chạy `scripts/export-openapi.ts` (xem `integrations/nestjs/`) → `openapi.json`.
   - BE khác: dùng cơ chế sinh OpenAPI của framework đó.

2. **Xác định feature đích**
   - Từ context task (ticket, mô tả, code vừa sửa) → chọn `feature id` trong kit (`list_features`).
   - Nếu chưa có feature tương ứng → báo người dùng tạo (`doc-kit new`) trước.

3. **Chọn selector — phần chỉ AI làm tốt**
   - Liệt kê path/operation bạn vừa động tới.
   - Map về feature bằng **một** trong:
     - `tags`: nếu endpoint có `@ApiTags`/tag khớp nhóm feature.
     - `paths`: glob path thuộc feature, vd `["/onboarding/**"]` (`*`=1 segment, `**`=nhiều).
   - Nếu cả service chỉ phục vụ 1 feature → bỏ trống selector (lấy nguyên spec).
   - ⚠️ Đừng tự copy/cắt JSON bằng tay — đưa selector cho kit để nó kéo theo `$ref` đầy đủ.

4. **Đẩy lên**
   - Ưu tiên MCP: `push_api_doc(id, openapi, paths?, tags?, note?)`.
   - Hoặc CLI: `doc-kit push-api <id> openapi.json --tags ... | --paths ... [--note "..."]`.
   - `note` nên mô tả thay đổi (thêm endpoint / đổi response / breaking…).

5. **Kiểm & báo**
   - Kit trả về số endpoint đã gắn + `api.version` mới. Đối chiếu với những gì bạn vừa build.
   - Nhắc: đã set `needs_fe_repull=true` → FE nên `get_feature` lại.
   - Nếu là **breaking change**, ghi rõ trong `note` để CHANGELOG cảnh báo FE.

## Nguyên tắc
- Một lần push = một feature. Service nhiều feature → push nhiều lần với selector khác nhau.
- Không sửa tay `03-api/api-spec.md` (kit sinh). Muốn đổi → sửa nguồn OpenAPI rồi push lại.
- Trung thực số endpoint: nếu kit cắt ra ít/nhiều hơn dự kiến → selector sai, sửa lại.

# Conventions — Quy ước chung FE/BE

> Quy ước áp dụng cho mọi feature. Spec từng feature chỉ ghi phần *khác biệt*.

## API
- Base path, versioning: `/api/v1/...`
- Định dạng lỗi chuẩn (khớp với BE NestJS):

```json
{ "statusCode": 400, "message": "mô tả", "error": "Bad Request" }
```

- Phân trang: `?page=1&pageSize=20` → response `{ data: [], meta: { total, page, pageSize } }`
- Auth: Bearer JWT ở header `Authorization`.
- Thời gian: ISO 8601 UTC (`2026-06-14T10:00:00Z`).

## Naming
- API field: `camelCase`.
- Feature id: `F-<số>-<slug>`.
- Component / màn hình: tên thống nhất giữa design-spec và code.

## FE
- **Web**: Next.js / React + TypeScript.
- **Mobile**: React Native.
- Phần khác biệt nền tảng ghi ở `02-design-spec.md` mục "Platform notes".

## BE
- NestJS. OpenAPI sinh từ decorator `@nestjs/swagger`.
- Mỗi feature export một OpenAPI rồi `doc-kit push-api`.

## Trạng thái & lỗi UI
- Mọi màn hình cần định nghĩa: loading / empty / error / success.

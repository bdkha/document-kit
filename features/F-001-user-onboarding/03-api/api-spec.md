---
feature: F-001-user-onboarding
doc: api-spec
version: 1
generated: true
source: openapi.yaml
updated_at: "2026-06-14"
---

# API Spec — User Onboarding API

> ⚙️ File SINH RA từ `03-api/openapi.yaml`. **Không sửa tay** — sửa nguồn rồi chạy `doc-kit push-api`.

API phục vụ luồng onboarding người dùng mới.

- OpenAPI: `3.0.3`  •  API doc version: `1.0.0`
- Servers: `https://api.example.com/api/v1`
- Auth: bearerAuth (http/bearer)

## Endpoints

| Method | Path | Tóm tắt |
|--------|------|---------|
| GET | `/onboarding/state` | Lấy trạng thái onboarding của người dùng hiện tại |
| POST | `/onboarding/steps/{stepId}/complete` | Đánh dấu hoàn thành một bước |

## Chi tiết endpoint

### GET `/onboarding/state`

Lấy trạng thái onboarding của người dùng hiện tại

- operationId: `getOnboardingState`

**Responses**

| Code | Kiểu | Mô tả |
|------|------|-------|
| 200 | [OnboardingState](#model-onboardingstate) | Trạng thái onboarding |
| 401 | — | Chưa đăng nhập |

---

### POST `/onboarding/steps/{stepId}/complete`

Đánh dấu hoàn thành một bước

- operationId: `completeStep`

| Param | Vị trí | Bắt buộc | Kiểu | Mô tả |
|-------|--------|----------|------|-------|
| `stepId` | path | ✓ | string(uuid) | Bước cần hoàn thành |

**Responses**

| Code | Kiểu | Mô tả |
|------|------|-------|
| 200 | [OnboardingState](#model-onboardingstate) | Đã cập nhật |
| 404 | — | Không tìm thấy bước |

---

## Data models

### <a id="model-onboardingstep"></a>OnboardingStep

| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `id` | string(uuid) | ✓ | Định danh bước |
| `order` | integer | ✓ | Thứ tự hiển thị |
| `title` | string |  |  |
| `completed` | boolean | ✓ |  |

### <a id="model-onboardingstate"></a>OnboardingState

| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `userId` | string(uuid) |  |  |
| `steps` | [OnboardingStep](#model-onboardingstep)[] |  |  |


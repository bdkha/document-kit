# Data Models — Domain entity dùng chung

> Entity dùng ở nhiều feature → định nghĩa 1 lần ở đây, feature link tới.
> Là nguồn chung FE/BE thống nhất tên field, kiểu, ràng buộc. Không phải DB schema.

Định dạng mỗi entity:

### <Entity>
| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| id | string (uuid) | ✓ | định danh |

- **Quan hệ**: ...
- **Dùng ở feature**: F-...

---

<!-- Ví dụ:
### User
| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| id | string (uuid) | ✓ | định danh người dùng |
| email | string | ✓ | duy nhất |
| displayName | string |   | tên hiển thị |
-->

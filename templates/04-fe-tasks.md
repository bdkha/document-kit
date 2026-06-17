---
feature: F-000-slug
doc: fe-tasks
version: 1
status: draft
updated_at: "1970-01-01"
---

# FE Tasks — {Tên feature}

> Ghép business-spec + api-spec + design-spec thành task FE làm được ngay.
> Mỗi task tự đủ ngữ cảnh: story nào, API nào, screen nào, AC nào.

## Checklist tiền đề
- [ ] `status` >= `in-dev`
- [ ] `api.version` >= 1 (BE đã đẩy OpenAPI)
- [ ] Đã đọc `01-business-spec.md` + `03-api/api-spec.md` + `02-design-spec.md`

> Task bảo trì (bug fix / cải tiến): đặt `Loại` = bugfix|improvement và tham chiếu
> entry CHANGELOG + ticket tương ứng thay vì viết lại toàn bộ context.

## Tasks

### TASK-1: <tên task>
- **Loại**: feature | bugfix | improvement
- **Platform**: web | react-native
- **Story liên quan**: (US ở business-spec)
- **Screen**: (link node Figma ở design-spec)
- **API dùng**: `GET /...`, `POST /...` (tham chiếu api-spec)
- **Việc cần làm**:
  1. ...
- **Acceptance**: thoả AC-… ở business-spec
- **Ghi chú**: state rỗng/lỗi/loading lấy từ design-spec mục 4

---

### TASK-2: <tên task>
- **Loại**: feature | bugfix | improvement
...

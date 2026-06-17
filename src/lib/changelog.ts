import fs from "node:fs";

/** Ngày hôm nay dạng YYYY-MM-DD. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Chèn một entry vào đầu danh sách CHANGELOG (mới nhất lên trên):
 *  - chèn ngay trước mục "## " đầu tiên, giữ nguyên phần prose phía trên;
 *  - nếu chưa có mục "## " nào thì chèn sau dòng tiêu đề "# ";
 *  - nếu file chưa tồn tại thì tạo mới với tiêu đề từ `title`.
 */
export function prependChangelogEntry(changelogPath: string, entry: string, title: string): void {
  const existing = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, "utf8")
    : `# Changelog — ${title}\n\n`;
  const lines = existing.split("\n");
  let insertAt = lines.findIndex((l) => /^## /.test(l));
  if (insertAt < 0) {
    const headerIdx = lines.findIndex((l) => l.startsWith("# "));
    insertAt = headerIdx >= 0 ? headerIdx + 1 : 0;
  }
  lines.splice(insertAt, 0, entry, "");
  fs.writeFileSync(changelogPath, lines.join("\n"), "utf8");
}

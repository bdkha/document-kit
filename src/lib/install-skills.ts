import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { skillsSourceDir } from "./paths.js";

/**
 * Cài skills của kit vào nơi Claude Code tự nạp:
 *  - project (mặc định): <cwd>/.claude/skills  (hoặc thư mục chỉ định)
 *  - global (--global):  ~/.claude/skills
 *
 * Cần thiết vì Claude Code chỉ nạp skills ở project root / user dir, KHÔNG nạp trong
 * submodule (vd docs/kit/.claude/skills). Cài để dùng skill ở repo FE/BE bất kỳ.
 */

export interface InstallSkillsResult {
  dest: string;
  installed: string[];
}

export function installSkills(opts: { global?: boolean; dir?: string } = {}): InstallSkillsResult {
  const src = skillsSourceDir();
  if (!fs.existsSync(src)) throw new Error(`Không tìm thấy skills nguồn: ${src}`);

  const base = opts.global
    ? path.join(os.homedir(), ".claude", "skills")
    : path.join(opts.dir ? path.resolve(opts.dir) : process.cwd(), ".claude", "skills");

  fs.mkdirSync(base, { recursive: true });

  const installed: string[] = [];
  for (const name of fs.readdirSync(src, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const from = path.join(src, name.name);
    const to = path.join(base, name.name);
    fs.cpSync(from, to, { recursive: true });
    installed.push(name.name);
  }

  return { dest: base, installed: installed.sort() };
}

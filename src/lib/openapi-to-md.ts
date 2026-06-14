/**
 * Chuyển OpenAPI (3.x) thành markdown AI-friendly.
 * Mục tiêu không phải đẹp mắt mà là: AI đọc nhanh, đủ để gọi API đúng.
 */

interface AnyObj {
  [k: string]: any;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

function schemaToType(schema: AnyObj | undefined): string {
  if (!schema) return "any";
  if (schema.$ref) return `[${refName(schema.$ref)}](#model-${slug(refName(schema.$ref))})`;
  if (schema.enum) return `enum(${schema.enum.join(" | ")})`;
  if (schema.type === "array") return `${schemaToType(schema.items)}[]`;
  if (schema.allOf) return schema.allOf.map(schemaToType).join(" & ");
  if (schema.oneOf) return schema.oneOf.map(schemaToType).join(" | ");
  if (schema.anyOf) return schema.anyOf.map(schemaToType).join(" | ");
  if (schema.format) return `${schema.type}(${schema.format})`;
  return schema.type ?? "object";
}

function refName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderParams(params: AnyObj[] | undefined): string {
  if (!params || params.length === 0) return "";
  const rows = params.map((p) => {
    const t = schemaToType(p.schema);
    return `| \`${p.name}\` | ${p.in} | ${p.required ? "✓" : ""} | ${t} | ${oneLine(p.description)} |`;
  });
  return [
    "",
    "| Param | Vị trí | Bắt buộc | Kiểu | Mô tả |",
    "|-------|--------|----------|------|-------|",
    ...rows,
    "",
  ].join("\n");
}

function renderBody(requestBody: AnyObj | undefined): string {
  if (!requestBody) return "";
  const content = requestBody.content ?? {};
  const json = content["application/json"];
  const type = json?.schema ? schemaToType(json.schema) : "—";
  const req = requestBody.required ? " (bắt buộc)" : "";
  return `\n**Request body**${req}: \`${type}\`\n`;
}

function renderResponses(responses: AnyObj | undefined): string {
  if (!responses) return "";
  const rows = Object.entries(responses).map(([code, r]: [string, any]) => {
    const json = r.content?.["application/json"];
    const type = json?.schema ? schemaToType(json.schema) : "—";
    return `| ${code} | ${type} | ${oneLine(r.description)} |`;
  });
  return [
    "",
    "**Responses**",
    "",
    "| Code | Kiểu | Mô tả |",
    "|------|------|-------|",
    ...rows,
    "",
  ].join("\n");
}

function renderModels(schemas: AnyObj | undefined): string {
  if (!schemas || Object.keys(schemas).length === 0) return "";
  const out: string[] = ["", "## Data models", ""];
  for (const [name, schema] of Object.entries<AnyObj>(schemas)) {
    out.push(`### <a id="model-${slug(name)}"></a>${name}`, "");
    const props = schema.properties ?? {};
    const required: string[] = schema.required ?? [];
    if (Object.keys(props).length === 0) {
      out.push(`Kiểu: \`${schemaToType(schema)}\``, "");
      continue;
    }
    out.push("| Field | Kiểu | Bắt buộc | Mô tả |", "|-------|------|----------|-------|");
    for (const [field, fs] of Object.entries<AnyObj>(props)) {
      out.push(
        `| \`${field}\` | ${schemaToType(fs)} | ${required.includes(field) ? "✓" : ""} | ${oneLine(fs.description)} |`,
      );
    }
    out.push("");
  }
  return out.join("\n");
}

function oneLine(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim();
}

export function openapiToMarkdown(spec: AnyObj, opts: { featureId: string; apiVersion: number; updatedAt: string }): string {
  const info = spec.info ?? {};
  const lines: string[] = [];

  lines.push("---");
  lines.push(`feature: ${opts.featureId}`);
  lines.push("doc: api-spec");
  lines.push(`version: ${opts.apiVersion}`);
  lines.push("generated: true");
  lines.push(`source: openapi.yaml`);
  lines.push(`updated_at: "${opts.updatedAt}"`);
  lines.push("---");
  lines.push("");
  lines.push(`# API Spec — ${info.title ?? opts.featureId}`);
  lines.push("");
  lines.push("> ⚙️ File SINH RA từ `03-api/openapi.yaml`. **Không sửa tay** — sửa nguồn rồi chạy `doc-kit push-api`.");
  lines.push("");
  if (info.description) {
    lines.push(oneLine(info.description), "");
  }
  lines.push(`- OpenAPI: \`${spec.openapi ?? "?"}\`  •  API doc version: \`${info.version ?? opts.apiVersion}\``);

  // Servers
  if (Array.isArray(spec.servers) && spec.servers.length) {
    lines.push(`- Servers: ${spec.servers.map((s: AnyObj) => `\`${s.url}\``).join(", ")}`);
  }
  // Auth
  const sec = spec.components?.securitySchemes;
  if (sec && Object.keys(sec).length) {
    const names = Object.entries<AnyObj>(sec).map(([k, v]) => `${k} (${v.type}${v.scheme ? "/" + v.scheme : ""})`);
    lines.push(`- Auth: ${names.join(", ")}`);
  }
  lines.push("");

  // Endpoints overview
  lines.push("## Endpoints", "");
  lines.push("| Method | Path | Tóm tắt |", "|--------|------|---------|");
  const paths = spec.paths ?? {};
  for (const [p, item] of Object.entries<AnyObj>(paths)) {
    for (const m of HTTP_METHODS) {
      if (item[m]) {
        lines.push(`| ${m.toUpperCase()} | \`${p}\` | ${oneLine(item[m].summary)} |`);
      }
    }
  }
  lines.push("");

  // Endpoint details
  lines.push("## Chi tiết endpoint", "");
  for (const [p, item] of Object.entries<AnyObj>(paths)) {
    const commonParams: AnyObj[] = item.parameters ?? [];
    for (const m of HTTP_METHODS) {
      const op = item[m];
      if (!op) continue;
      lines.push(`### ${m.toUpperCase()} \`${p}\``, "");
      if (op.summary) lines.push(oneLine(op.summary), "");
      if (op.description) lines.push(oneLine(op.description), "");
      if (op.operationId) lines.push(`- operationId: \`${op.operationId}\``, "");
      const allParams = [...commonParams, ...(op.parameters ?? [])];
      lines.push(renderParams(allParams));
      lines.push(renderBody(op.requestBody));
      lines.push(renderResponses(op.responses));
      lines.push("---", "");
    }
  }

  lines.push(renderModels(spec.components?.schemas));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

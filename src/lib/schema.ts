import fs from "node:fs";
import AjvModule from "ajv";
import addFormatsModule from "ajv-formats";
import type { ValidateFunction } from "ajv";
import { schemaPath } from "./paths.js";

// Interop: dưới ESM/NodeNext, default export của ajv (CJS) có thể nằm trong .default
const Ajv: any = (AjvModule as any).default ?? AjvModule;
const addFormats: any = (addFormatsModule as any).default ?? addFormatsModule;

let validator: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (validator) return validator;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(schemaPath(), "utf8"));
  const compiled = ajv.compile(schema);
  validator = compiled;
  return compiled;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate object metadata feature theo JSON Schema. */
export function validateFeatureMeta(meta: unknown): ValidationResult {
  const validate = getValidator();
  const valid = validate(meta) as boolean;
  const errors = (validate.errors ?? []).map(
    (e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim(),
  );
  return { valid, errors };
}

/**
 * Script mẫu (copy vào BE repo NestJS): xuất OpenAPI ra file mà KHÔNG chạy HTTP server.
 *
 * Dùng:
 *   ts-node scripts/export-openapi.ts            # ghi ra openapi.json
 *   ts-node scripts/export-openapi.ts out.json
 *
 * Sau đó AI/người gắn API vào feature qua kit:
 *   node docs/kit/dist/cli/index.js push-api F-001-user-onboarding openapi.json \
 *        --tags onboarding --ci
 *
 * Lưu ý: chỉnh import AppModule cho đúng đường dẫn BE của bạn.
 */
import { writeFileSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
// 👇 sửa path cho khớp BE repo
import { AppModule } from "../src/app.module";

async function main() {
  const out = process.argv[2] ?? "openapi.json";

  // Tạo app context, KHÔNG listen port.
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle(process.env.API_TITLE ?? "Service API")
    .setVersion(process.env.API_VERSION ?? "1.0.0")
    .addBearerAuth()
    // Khuyến nghị: gắn @ApiTags('<feature-id|tên-nhóm>') ở controller để dễ cắt theo feature.
    .build();

  const document = SwaggerModule.createDocument(app, config);
  writeFileSync(out, JSON.stringify(document, null, 2), "utf8");
  await app.close();

  // eslint-disable-next-line no-console
  console.log(`OpenAPI đã ghi: ${out} (${Object.keys(document.paths ?? {}).length} path)`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

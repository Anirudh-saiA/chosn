/**
 * Day 37 curation helper — sets sneakers.primary_image_url for one
 * style code directly, without needing to mint an admin API token.
 * Same rationale as fetch-once.ts/mi:refresh-now: a Railway Console
 * script for a one-off operational action, not a recurring tool.
 * POST /admin/catalog/:styleCode/image (admin-guarded) remains the
 * real path for anyone who does have a session; this is the no-token
 * alternative.
 *
 *   node apps/api/dist/scripts/set-primary-image.js <styleCode> <imageUrl>
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { sneakers } from '../db/schema';

async function main() {
  const logger = new Logger('set-primary-image');
  const [styleCode, imageUrl] = process.argv.slice(2);
  if (!styleCode || !imageUrl) {
    console.error('Usage: node apps/api/dist/scripts/set-primary-image.js <styleCode> <imageUrl>');
    process.exit(1);
  }
  if (!imageUrl.startsWith('https://')) {
    console.error('imageUrl must be https://');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    const db = app.get<Db>(DRIZZLE);
    const [row] = await db
      .update(sneakers)
      .set({ primaryImageUrl: imageUrl, updatedAt: new Date() })
      .where(eq(sneakers.styleCode, styleCode))
      .returning({ id: sneakers.id, styleCode: sneakers.styleCode, primaryImageUrl: sneakers.primaryImageUrl });

    if (!row) {
      console.error(`No sneaker with style_code "${styleCode}"`);
      process.exit(1);
    }
    logger.log(`set primary_image_url for ${row.styleCode}: ${row.primaryImageUrl}`);
  } finally {
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

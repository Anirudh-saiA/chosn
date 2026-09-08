import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { classifyText } from './classifier.service';
import { ClassifyTextDto } from './dto/classify-text.dto';

/**
 * Admin-only, not a public endpoint — this exists so the classifier
 * integration (task 6) is a real, callable, verifiable thing today
 * ("a known-working integration, not a Day-40 unknown") even with no
 * live UGC feature yet to gate. Once posts/comments ship, they call
 * `classifyText` directly from their own submission path; this
 * endpoint stays as the admin-facing way to sanity-check the
 * integration itself (e.g. after rotating `PERSPECTIVE_API_KEY`).
 */
@Controller('moderation')
export class ModerationController {
  @Post('classify-text')
  @HttpCode(200)
  @UseGuards(ApiAuthGuard, AdminGuard)
  async classify(@Body() dto: ClassifyTextDto) {
    const result = await classifyText(dto.text);
    if (result === null) {
      return { configured: false, message: 'PERSPECTIVE_API_KEY is unset or the classifier is unreachable — see moderation/classifier.service.ts.' };
    }
    return { configured: true, ...result };
  }
}

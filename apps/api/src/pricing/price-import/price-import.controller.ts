import { Body, Controller, Get, Header, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AdminGuard } from '../../auth/admin.guard';
import { ApiAuthGuard, type AuthenticatedRequest } from '../../auth/api-auth.guard';
import { csvTemplate } from './price-csv';
import { PriceImportService } from './price-import.service';

class ImportCsvDto {
  @IsString()
  @MinLength(1)
  @MaxLength(900_000)
  csv!: string;
}

/**
 * Admin-only CSV price import. POST with ?dryRun=true first to see what would
 * happen (nothing is written), then again without it to save.
 */
@Controller('admin/prices')
@UseGuards(ApiAuthGuard, AdminGuard)
export class PriceImportController {
  constructor(private readonly importer: PriceImportService) {}

  @Get('template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="chosn-prices-template.csv"')
  template(): string {
    return csvTemplate();
  }

  @Post('import')
  async import(@Body() dto: ImportCsvDto, @Query('dryRun') dryRun: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.importer.importCsv(dto.csv, {
      dryRun: dryRun === 'true' || dryRun === '1',
      recordedBy: `csv-import:${req.user.email}`,
    });
  }
}

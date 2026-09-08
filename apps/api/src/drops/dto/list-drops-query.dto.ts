import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsOptional } from 'class-validator';
import type { DropStatus } from '../drops.service';

const VALID_STATUSES: DropStatus[] = ['upcoming', 'live', 'sold_out'];

export class ListDropsQueryDto {
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  /** Comma-separated in the URL (`?status=upcoming,live`); split before validating each value against the real enum rather than trusting the raw string through to a raw SQL IN (...) clause. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((s) => s.trim()) : value))
  @IsArray()
  @IsIn(VALID_STATUSES, { each: true })
  status?: DropStatus[];
}

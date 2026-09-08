import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const REVIEW_STATUSES = ['reviewed', 'actioned', 'dismissed'] as const;

/** Never accepts 'pending' — that's only ever the row's own default, not a state an admin action moves it back to. */
export class ReviewReportDto {
  @IsIn(REVIEW_STATUSES)
  status!: (typeof REVIEW_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

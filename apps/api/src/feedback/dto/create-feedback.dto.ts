import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const TOPICS = ['price_trust', 'design_feel', 'positioning', 'other'] as const;

export class CreateFeedbackDto {
  @IsOptional()
  @IsIn(TOPICS)
  topic?: (typeof TOPICS)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  sourcePath?: string;
}

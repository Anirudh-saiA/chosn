import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class CheckRateLimitDto {
  @IsString()
  @MaxLength(200)
  key!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  limit!: number;

  @IsInt()
  @Min(1)
  @Max(86_400)
  windowSeconds!: number;
}

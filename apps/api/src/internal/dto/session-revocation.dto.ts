import { IsInt, IsUUID, Min } from 'class-validator';

export class RevokeSessionsDto {
  @IsUUID()
  userId!: string;
}

export class CheckRevocationDto {
  @IsUUID()
  userId!: string;

  @IsInt()
  @Min(0)
  issuedAtSeconds!: number;
}

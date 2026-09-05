import { IsArray, IsEmail, IsIn, IsOptional } from 'class-validator';

export const ALLOWED_INTERESTS = ['Jordan', 'Nike', 'Yeezy', 'Price alerts', 'Drop news'] as const;

export class JoinWaitlistDto {
  @IsEmail({}, { message: 'That email looks invalid.' })
  email!: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALLOWED_INTERESTS, { each: true, message: 'Unrecognized interest.' })
  interests?: string[];
}

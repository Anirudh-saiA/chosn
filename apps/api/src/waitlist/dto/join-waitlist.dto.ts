import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export const ALLOWED_INTERESTS = ['Jordan', 'Nike', 'Yeezy', 'Price alerts', 'Drop news'] as const;

export class JoinWaitlistDto {
  @IsString({ message: 'Tell us your name.' })
  @Length(1, 60, { message: 'Tell us your name.' })
  name!: string;

  @IsEmail({}, { message: 'That email looks invalid.' })
  email!: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALLOWED_INTERESTS, { each: true, message: 'Unrecognized interest.' })
  interests?: string[];

  /** Free-text shoes they're hunting, e.g. "Jordan 4 Military Blue". */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  shoes?: string[];
}

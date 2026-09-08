import { IsEmail, IsOptional } from 'class-validator';

/**
 * Creates (or, given a known email, reuses) a `subscribers` row — the
 * bare identity anchor Day 12 designed in place of full accounts. Email
 * is optional: a visitor who only wants push notifications never has to
 * type one.
 */
export class IdentifyDto {
  @IsOptional()
  @IsEmail({}, { message: 'That email looks invalid.' })
  email?: string;
}

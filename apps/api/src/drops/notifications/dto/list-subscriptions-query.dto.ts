import { IsOptional, IsUUID } from 'class-validator';

/** Day 16 task 5 — `subscriberId` used to reach a typed Drizzle `eq()` against a UUID column completely unvalidated; a malformed value (not just a missing one, which is a legitimate "no subscriber yet" state) 500'd instead of 400ing. */
export class ListSubscriptionsQueryDto {
  @IsOptional()
  @IsUUID()
  subscriberId?: string;
}

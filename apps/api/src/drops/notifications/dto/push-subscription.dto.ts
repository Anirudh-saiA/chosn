import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, ValidateNested } from 'class-validator';

/**
 * `keys.p256dh` / `keys.auth` match the shape `PushSubscription.toJSON()`
 * hands back from the browser — not IsUrl()'d beyond IsNotEmpty(): a
 * push service endpoint is store-and-forward data this server only ever
 * echoes back to the browser's own push service, never parses or acts
 * on, so an overly strict URL validator here risks rejecting a
 * legitimate endpoint shape more than it protects anything.
 */
class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class PushSubscribeDto {
  @IsUUID()
  subscriberId!: string;

  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class PushUnsubscribeDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;
}

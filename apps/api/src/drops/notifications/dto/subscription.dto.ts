import {
  IsIn,
  IsUUID,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/** Matches the `subscription_scope` enum from 0006 — brand/model default per Day 12, global available but not pushed as the default. */
export const SUBSCRIPTION_SCOPES = ['brand', 'model', 'global'] as const;
export type SubscriptionScope = (typeof SUBSCRIPTION_SCOPES)[number];

/**
 * Mirrors 0006's scope_value CHECK constraint (required for brand/
 * model, forbidden for global) so a malformed request 400s here rather
 * than surfacing as an opaque Postgres constraint-violation 500.
 *
 * Written as a single custom validator rather than two stacked
 * `@ValidateIf` blocks on one property — tried that first, and a direct
 * test (plainToInstance + validate() against all four cases) showed
 * class-validator does not combine two `@ValidateIf` conditions on the
 * same property the way it might look like it should; every case came
 * back VALID, silently accepting a global subscription with a
 * scopeValue attached. This form was verified against the same four
 * cases before being kept.
 */
function IsValidScopeValue(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isValidScopeValue',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const scopeType = (args.object as SubscriptionDto).scopeType;
          if (scopeType === 'global') return value === undefined;
          return typeof value === 'string' && value.trim().length > 0;
        },
        defaultMessage() {
          return 'scopeValue is required for brand/model subscriptions, and must be omitted for a global subscription.';
        },
      },
    });
  };
}

/**
 * Used for both creating and removing a subscription — same natural key
 * (subscriberId, scopeType, scopeValue) either way, matching how the
 * database itself identifies one (0006's COALESCE-based unique index).
 */
export class SubscriptionDto {
  @IsUUID()
  subscriberId!: string;

  @IsIn(SUBSCRIPTION_SCOPES)
  scopeType!: SubscriptionScope;

  @IsValidScopeValue()
  scopeValue?: string;
}

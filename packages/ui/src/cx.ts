/** Tiny className joiner — no need for a dependency just for this. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

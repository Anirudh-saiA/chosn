const TZ_OFFSETS: Record<string, string> = {
  'Asia/Kolkata': '+05:30',
  'Asia/Calcutta': '+05:30',
  UTC: '+00:00',
  'America/New_York': '-05:00',
  'America/Los_Angeles': '-08:00',
};

/** Release instant as an ISO string (releases with no time are treated as midnight IST). */
export function releaseInstant(date: string, time: string | null, tz: string): string {
  const offset = TZ_OFFSETS[tz] ?? '+05:30';
  return `${date}T${time ?? '00:00:00'}${offset}`;
}


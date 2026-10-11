/** Calendar input is local to the current browser; wire values are absolute instants. */
export function localInput(value: string): string {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return value;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function localInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const candidate = new Date(value);
  if (!Number.isFinite(candidate.getTime()) || localInput(candidate.toISOString()) !== value)
    return value;
  // Sample both sides of a transition, including zones with half-hour DST changes.
  const wall=Date.parse(value+'Z'), candidates=new Set<string>();
  for(const hours of [-36,-12,0,12,36]) {
    const offset=new Date(wall+hours*3600000).getTimezoneOffset();
    const instant=new Date(wall+offset*60000).toISOString();
    if(localInput(instant)===value)candidates.add(instant);
  }
  return candidates.size===1 ? [...candidates][0] : value;
}

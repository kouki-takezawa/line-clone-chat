const PALETTE = [
  "bg-pink-200",
  "bg-sky-200",
  "bg-amber-200",
  "bg-lime-200",
  "bg-violet-200",
  "bg-rose-200",
];

export function avatarColorFor(id: string): string {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
}

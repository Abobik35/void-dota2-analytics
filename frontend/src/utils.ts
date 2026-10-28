/** Время матча в секундах → "m:ss"; до горна — со знаком минус. */
export const clock = (t: number | null) =>
  t == null ? "—" : `${t < 0 ? "−" : ""}${Math.floor(Math.abs(t) / 60)}:${String(Math.abs(t) % 60).padStart(2, "0")}`;

/** Account ID (3–10 цифр) или SteamID64 (16–17 цифр) → строка с Account ID; иначе null. */
export function parseAccountId(input: string): string | null {
  const v = input.trim();
  if (/^\d{16,17}$/.test(v)) {
    const id = BigInt(v) - 76561197960265728n;
    return id > 0n && id < 4294967296n ? id.toString() : null;
  }
  return /^\d{3,10}$/.test(v) ? v : null;
}

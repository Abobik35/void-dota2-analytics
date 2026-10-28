export interface Player {
  slot: number; is_radiant: boolean; account_id: number | null; name: string | null;
  hero_id: number; hero_name: string; hero_img: string | null; level: number | null;
  kills: number; deaths: number; assists: number; kda: number;
  gpm: number | null; xpm: number | null; last_hits: number | null; denies: number | null;
  hero_damage: number | null; tower_damage: number | null; hero_healing: number | null; net_worth: number | null;
}
export interface Match {
  match_id: number; start_time: number | null; duration: number | null;
  radiant_win: boolean | null; radiant_score: number | null; dire_score: number | null;
  game_mode: number | null; data_status: "full" | "basic"; players: Player[];
}
export interface Timeline { available: boolean; minutes: number[]; gold_adv: number[]; xp_adv: number[]; reason: string | null }
export interface Team {
  side: "radiant" | "dire"; kills: number; deaths: number; assists: number; last_hits: number;
  hero_damage: number; tower_damage: number; hero_healing: number;
  net_worth: number | null; avg_gpm: number | null; avg_xpm: number | null;
}
export interface Analytics { radiant: Team; dire: Team }

async function get<T>(path: string): Promise<T> {
  let r: Response;
  try { r = await fetch(`/api/v1${path}`); }
  catch { throw new Error("Backend недоступен. Запущен ли start_backend.bat?"); }
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Ошибка запроса (${r.status}).`);
  }
  return r.json();
}
export const getMatch = (id: string) => get<Match>(`/matches/${id}`);
export const getTimeline = (id: string) => get<Timeline>(`/matches/${id}/timeline`);
export const getAnalytics = (id: string) => get<Analytics>(`/matches/${id}/analytics`);

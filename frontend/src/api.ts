export interface Player {
  slot: number; is_radiant: boolean; account_id: number | null; name: string | null;
  hero_id: number; hero_name: string; hero_img: string | null; level: number | null;
  kills: number; deaths: number; assists: number; kda: number;
  gpm: number | null; xpm: number | null; last_hits: number | null; denies: number | null;
  hero_damage: number | null; tower_damage: number | null; hero_healing: number | null; net_worth: number | null;
  kill_participation: number | null;
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

async function get<T>(path: string, method = "GET"): Promise<T> {
  let r: Response;
  try { r = await fetch(`/api/v1${path}`, { method }); }
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

export interface RatedPlayer {
  slot: number; is_radiant: boolean; account_id: number | null; name: string | null;
  hero_name: string; hero_img: string | null; role: "core" | "support" | "unknown";
  rating: number; categories: Record<string, number | null>; completeness: number;
  positives: string[]; negatives: string[];
}
export interface Mvp {
  slot: number; account_id: number | null; name: string | null; hero_name: string; hero_img: string | null;
  rating: number | null; basis: "void_rating" | "kda"; reasons: string[];
}
export interface VoidRating {
  version: string; available: boolean; reason: string | null; mvp: Mvp | null;
  players: RatedPlayer[]; limitations: string[];
}
export const getVoidRating = (id: string) => get<VoidRating>(`/matches/${id}/void-rating`);

export interface ParseRequest { status: "queued" | "already_parsed" | "recently_requested"; job_id: number | null }
export const requestParse = (id: string) => get<ParseRequest>(`/matches/${id}/parse`, "POST");
export const getParseStatus = (id: string) => get<{ parsed: boolean }>(`/matches/${id}/parse-status`);

export interface PlayerProfile {
  account_id: number; name: string | null; avatar: string | null; rank_tier: number | null; mmr_estimate: number | null;
  lifetime_wins: number | null; lifetime_losses: number | null; lifetime_win_rate: number | null;
}
export interface PlayerMatch {
  match_id: number; start_time: number | null; duration: number | null; game_mode: number | null; lobby_type: number | null;
  hero_id: number; hero_name: string; hero_img: string | null; won: boolean | null;
  kills: number; deaths: number; assists: number; kda: number; gpm: number | null; xpm: number | null; last_hits: number | null;
}
export interface PlayerMatches { items: PlayerMatch[]; next_offset: number | null }
export interface HeroStat { hero_id: number; hero_name: string; hero_img: string | null; games: number; wins: number; win_rate: number }
export interface PlayerAnalytics {
  sample_size: number; wins: number; losses: number; win_rate: number | null;
  avg_kills: number | null; avg_deaths: number | null; avg_assists: number | null; kda: number | null;
  avg_gpm: number | null; avg_xpm: number | null; gpm_sample: number;
  top_heroes: HeroStat[]; form: { match_id: number; won: boolean | null }[];
}
export interface Filters { days?: string; hero_id?: string }
export interface HeroRef { id: number; localized_name: string }

const qs = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
export const getPlayer = (id: string) => get<PlayerProfile>(`/players/${id}`);
export const getPlayerMatches = (id: string, offset: number, f: Filters) =>
  get<PlayerMatches>(`/players/${id}/matches?${qs({ limit: 20, offset, ...f })}`);
export const getPlayerAnalytics = (id: string, f: Filters) => get<PlayerAnalytics>(`/players/${id}/analytics?${qs({ limit: 100, ...f })}`);
export const getHeroes = () => get<HeroRef[]>("/heroes");

export interface ItemRef { id: number; key: string | null; name: string; img: string | null; cost: number | null }
export interface Purchase { time: number | null; key: string; name: string; img: string | null; cost: number | null }
export interface PlayerItems {
  slot: number; is_radiant: boolean; hero_name: string; hero_img: string | null; name: string | null; account_id: number | null;
  main: (ItemRef | null)[]; backpack: (ItemRef | null)[]; neutral: ItemRef | null; purchases: Purchase[] | null;
}
export interface ItemsOut { data_status: "full" | "basic"; players: PlayerItems[] }
export type Side = "radiant" | "dire";
export interface EventHero { name: string; img: string | null; team: Side | null }
export interface FlowEvent {
  time: number; type: "kill" | "buyback" | "roshan" | "building"; team: Side | null; text: string;
  actor: EventHero | null; target: EventHero | null; label: string | null;
}
export interface Ward { time: number; until: number; estimated: boolean; kind: "obs" | "sen"; team: Side; x: number; y: number }
export interface MapDeath { time: number; team: Side; x: number; y: number; count: number }
export interface HeatPoint { team: Side; x: number; y: number; w: number }
export interface BuildingEvent {
  time: number; owner: Side; kind: "tower" | "rax" | "ancient"; tier: number | null;
  lane: "top" | "mid" | "bot" | null; variant: "melee" | "range" | null; label: string;
}
export interface Teamfight {
  start: number | null; end: number | null; deaths: number; radiant_deaths: number; dire_deaths: number;
  radiant_gold_delta: number; dire_gold_delta: number; outcome: Side | "draw";
}
export interface TurningPoint { minute: number; delta: number; from_adv: number; to_adv: number; team: Side }
export interface Flow {
  available: boolean; reason: string | null; duration: number | null; summary: string[];
  events: FlowEvent[]; teamfights: Teamfight[]; turning_points: TurningPoint[];
  wards: Ward[]; deaths: MapDeath[]; lane_heat: HeatPoint[]; buildings: BuildingEvent[];
}
export const getItems = (id: string) => get<ItemsOut>(`/matches/${id}/items`);
export const getFlow = (id: string) => get<Flow>(`/matches/${id}/flow`);

export interface CommonHeroSide { games: number; wins: number; win_rate: number }
export interface CommonHero { hero_id: number; hero_name: string; hero_img: string | null; a: CommonHeroSide; b: CommonHeroSide }
export interface CompareSide { profile: PlayerProfile; analytics: PlayerAnalytics }
export interface Compare { a: CompareSide; b: CompareSide; common_heroes: CommonHero[]; warnings: string[] }
export const getCompare = (a: string, b: string, days?: string) => get<Compare>(`/compare?${qs({ a, b, days, limit: 100 })}`);

export const refreshPlayer = (id: string) => get<{ cache_cleared: number; refresh_requested: boolean }>(`/players/${id}/refresh`, "POST");

export interface Finding {
  time: number | null; kind: "solo_death" | "death_streak" | "first_death" | "buyback_wasted" | "idle_farm";
  severity: "info" | "warn"; text: string;
}
export interface PlayerMistakes {
  slot: number; is_radiant: boolean; hero_name: string; hero_img: string | null; name: string | null; account_id: number | null;
  stats: Record<string, number | null>; findings: Finding[];
}
export interface Mistakes { available: boolean; reason: string | null; highlights: string[]; players: PlayerMistakes[]; limitations: string[] }
export const getMistakes = (id: string) => get<Mistakes>(`/matches/${id}/mistakes`);

export interface TimedItem {
  key: string; name: string; img: string | null; cost: number | null; time: number;
  median: number | null; p25: number | null; p75: number | null; delta: number | null;
  games: number | null; here_wr: number | null; here_games: number | null;
}
export interface PlayerTimings {
  slot: number; is_radiant: boolean; hero_name: string; hero_img: string | null; name: string | null; account_id: number | null;
  items: TimedItem[]; avg_delta: number | null;
}
export interface Timings { available: boolean; reason: string | null; note: string; highlights: string[]; players: PlayerTimings[] }
export const getItemTimings = (id: string) => get<Timings>(`/matches/${id}/item-timings`);

export interface Me { logged_in: boolean; steam_id?: string; account_id?: number; name?: string | null; avatar?: string | null }
export const getMe = () => get<Me>("/auth/me");
export const logout = () => get<{ ok: boolean }>("/auth/logout", "POST");

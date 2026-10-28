import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { getAnalytics, getVoidRating, Player, Team } from "../api";
import { fmt, who } from "./PlayersTable";
import Segmented from "./Segmented";

type Key = "level" | "kills" | "deaths" | "assists" | "kda" | "kill_participation" | "gpm" | "xpm" | "last_hits" | "denies"
  | "hero_damage" | "tower_damage" | "hero_healing" | "net_worth";
interface Col { key: Key; label: string; hint: string; w: number; bar?: boolean }
const COLS: Col[] = [
  { key: "level", label: "Lvl", hint: "Уровень героя", w: 56 },
  { key: "kills", label: "K", hint: "Убийства", w: 60, bar: true },
  { key: "deaths", label: "D", hint: "Смерти", w: 56 },
  { key: "assists", label: "A", hint: "Помощь", w: 60, bar: true },
  { key: "kda", label: "KDA", hint: "(K + A) / max(D, 1)", w: 68 },
  { key: "kill_participation", label: "KP", hint: "Участие в убийствах команды: (K + A) / убийства команды", w: 76, bar: true },
  { key: "gpm", label: "GPM", hint: "Золото в минуту", w: 76, bar: true },
  { key: "xpm", label: "XPM", hint: "Опыт в минуту", w: 76, bar: true },
  { key: "last_hits", label: "LH", hint: "Добитые крипы", w: 68, bar: true },
  { key: "denies", label: "DN", hint: "Отказы", w: 56 },
  { key: "hero_damage", label: "Урон", hint: "Урон по героям", w: 92, bar: true },
  { key: "tower_damage", label: "Башни", hint: "Урон по зданиям", w: 84, bar: true },
  { key: "hero_healing", label: "Лечение", hint: "Лечение союзников", w: 84, bar: true },
  { key: "net_worth", label: "NW", hint: "Общая стоимость", w: 92, bar: true },
];
type Mode = "main" | "fight" | "eco" | "all";
const MODES: [Mode, string][] = [["main", "Основное"], ["fight", "Бой"], ["eco", "Экономика"], ["all", "Все"]];
const PRESET: Record<Mode, Key[]> = {
  main: ["kills", "deaths", "assists", "kda", "gpm", "xpm", "last_hits"],
  fight: ["kills", "deaths", "assists", "kill_participation", "hero_damage", "tower_damage", "hero_healing"],
  eco: ["level", "gpm", "xpm", "last_hits", "denies", "net_worth"],
  all: COLS.map((c) => c.key),
};
const compact = (v: number) => (v >= 10000 ? `${(v / 1000).toFixed(1).replace(".0", "")}k` : v.toLocaleString("ru-RU"));
const text = (p: Player, k: Key) => (k === "kda" ? p.kda.toFixed(2) : k === "kill_participation" ? (p.kill_participation == null ? "—" : `${p.kill_participation}%`) : fmt(p[k]));

interface Props { matchId: string; players: Player[]; radiantWin: boolean | null }

export default function PlayersView({ matchId, players, radiantWin }: Props) {
  const [mode, setMode] = useState<Mode>("main");
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "net_worth", desc: true });
  const [ready, setReady] = useState(false);
  const stats = useQuery({ queryKey: ["analytics", matchId], queryFn: () => getAnalytics(matchId) });
  const vr = useQuery({ queryKey: ["void", matchId], queryFn: () => getVoidRating(matchId) });
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);

  const shown = new Set(PRESET[mode]);
  const tpl = `250px ${COLS.map((c) => (shown.has(c.key) ? `${c.w}px` : "0px")).join(" ")}`;
  const maxes = useMemo(() => Object.fromEntries(COLS.map((c) => [c.key, Math.max(1, ...players.map((p) => p[c.key] ?? 0))])) as Record<Key, number>, [players]);
  const rating = useMemo(() => new Map((vr.data?.players ?? []).map((p) => [p.slot, p.rating])), [vr.data]);
  const mvp = vr.data?.mvp?.slot;
  const toggle = (key: Key) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
  const sorted = (side: boolean) => players.filter((p) => p.is_radiant === side)
    .sort((a, b) => ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * (sort.desc ? -1 : 1));

  const vsRows: [string, number | null, number | null][] = stats.data ? [
    ["Убийства", stats.data.radiant.kills, stats.data.dire.kills], ["Золото (NW)", stats.data.radiant.net_worth, stats.data.dire.net_worth],
    ["Урон по героям", stats.data.radiant.hero_damage, stats.data.dire.hero_damage], ["Урон по зданиям", stats.data.radiant.tower_damage, stats.data.dire.tower_damage],
  ] : [];

  const renderTeam = (side: boolean) => {
    const team: Team | undefined = stats.data?.[side ? "radiant" : "dire"];
    const won = radiantWin == null ? null : radiantWin === side;
    return (
      <section key={side ? "radiant" : "dire"} className={`card team-card ${side ? "radiant" : "dire"}`}>
        <header className="team-head">
          <h2>{side ? "Radiant" : "Dire"}</h2>
          {won != null && <span className={`tag ${won ? "win" : "lose"}`}>{won ? "Победа" : "Поражение"}</span>}
          <span className="team-meta muted">
            {team ? <>убийств {team.kills} · NW {team.net_worth != null ? compact(team.net_worth) : "—"} · GPM {team.avg_gpm ?? "—"} · урон {compact(team.hero_damage)}</> : null}
          </span>
        </header>
        <div className="pgrid">
          <div className="prow head" style={{ gridTemplateColumns: tpl }}>
            <div className="pc pc-first"><span className="pc-in">Игрок</span></div>
            {COLS.map((c) => (
              <div key={c.key} className="pc" data-on={shown.has(c.key)} aria-hidden={!shown.has(c.key)}>
                <span className="pc-in">
                  <button type="button" className="hbtn" title={c.hint} tabIndex={shown.has(c.key) ? 0 : -1} onClick={() => toggle(c.key)}>
                    {c.label}{sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}</button>
                </span>
              </div>))}
          </div>
          {sorted(side).map((p) => (
            <div key={p.slot} className={`prow ${side ? "rad-row" : "dire-row"}`} style={{ gridTemplateColumns: tpl }}>
              <div className="pc pc-first">
                <div className="pc-player">
                  {p.hero_img ? <img src={p.hero_img} alt="" width={56} height={32} /> : <span className="noimg big" />}
                  <span className="pc-name"><b>{p.hero_name}</b>
                    <small>{p.account_id ? <Link to={`/player/${p.account_id}`}>{who(p)}</Link> : who(p)}</small></span>
                  {rating.has(p.slot) && (
                    <span className={`vchip${mvp === p.slot ? " mvp" : ""}`} title={mvp === p.slot ? "MVP матча · VOID Rating" : "VOID Rating"}>
                      {mvp === p.slot && <Crown size={12} />}{Math.round(rating.get(p.slot)!)}</span>)}
                </div>
              </div>
              {COLS.map((c) => {
                const v = p[c.key];
                const pct = c.bar && v != null ? (c.key === "kill_participation" ? v : (v / maxes[c.key]) * 100) : 0;
                return (
                  <div key={c.key} className="pc" data-on={shown.has(c.key)} aria-hidden={!shown.has(c.key)}>
                    <span className="pc-in"><span className="v">{text(p, c.key)}</span>{c.bar && <i className="b" style={{ width: `${pct}%` }} />}</span>
                  </div>);
              })}
            </div>))}
        </div>
      </section>
    );
  };

  return (
    <>
      {vsRows.length > 0 && (
        <section className="card">
          <h2>Сравнение команд</h2>
          {vsRows.filter(([, r, d]) => r != null && d != null).map(([label, r, d]) => {
            const total = (r as number) + (d as number);
            const pct = total ? ((r as number) / total) * 100 : 50;
            return (
              <div key={label} className="vs" aria-label={`${label}: Radiant ${r}, Dire ${d}`}>
                <b className="rad">{compact(r as number)}</b>
                <span className="vs-mid"><small className="muted">{label}</small>
                  <span className="vs-bar"><i style={{ width: `${ready ? pct : 50}%` }} /></span></span>
                <b className="dire">{compact(d as number)}</b>
              </div>);
          })}
        </section>)}

      <div className="mode-row">
        <Segmented<Mode> options={MODES} value={mode} onChange={setMode} label="Набор показателей" />
        <span className="muted">Нажмите на заголовок столбца, чтобы отсортировать игроков внутри команды.</span>
      </div>
      {renderTeam(true)}
      {renderTeam(false)}
    </>
  );
}

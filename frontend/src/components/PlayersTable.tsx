import { useState } from "react";
import { Link } from "react-router-dom";
import { Player } from "../api";

type Key = "level" | "kills" | "deaths" | "assists" | "kda" | "kill_participation" | "gpm" | "xpm" | "last_hits" | "denies"
  | "hero_damage" | "tower_damage" | "hero_healing" | "net_worth" | "slot";
const COLS: [Exclude<Key, "slot">, string, string][] = [
  ["level", "Lvl", "Уровень героя"], ["kills", "K", "Убийства"], ["deaths", "D", "Смерти"], ["assists", "A", "Помощь"],
  ["kda", "KDA", "(K + A) / max(D, 1)"], ["kill_participation", "KP", "Участие в убийствах команды: (K + A) / убийства команды"],
  ["gpm", "GPM", "Золото в минуту"], ["xpm", "XPM", "Опыт в минуту"], ["last_hits", "LH", "Добитые крипы"], ["denies", "DN", "Отказы"],
  ["hero_damage", "Урон", "Урон по героям"], ["tower_damage", "Башни", "Урон по зданиям"],
  ["hero_healing", "Лечение", "Лечение союзников"], ["net_worth", "NW", "Общая стоимость"],
];
const PRESETS: [string, string, Key[]][] = [
  ["main", "Основное", ["kills", "deaths", "assists", "kda", "gpm", "xpm", "last_hits"]],
  ["fight", "Бой и поддержка", ["kills", "deaths", "assists", "kill_participation", "hero_damage", "tower_damage", "hero_healing"]],
  ["eco", "Экономика", ["level", "gpm", "xpm", "last_hits", "denies", "net_worth"]],
  ["all", "Все", COLS.map(([k]) => k)],
];
export const fmt = (v: number | null) => (v == null ? "—" : v.toLocaleString("ru-RU"));
export const who = (p: { name: string | null; account_id: number | null }) =>
  p.name ?? (p.account_id ? `Игрок ${p.account_id}` : "Скрытый профиль");
const cell = (p: Player, k: Exclude<Key, "slot">) =>
  k === "kda" ? p.kda.toFixed(2) : k === "kill_participation" ? (p.kill_participation == null ? "—" : `${p.kill_participation}%`) : fmt(p[k]);

export default function PlayersTable({ players }: { players: Player[] }) {
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "slot", desc: false });
  const [preset, setPreset] = useState("main");
  const shown = new Set(PRESETS.find(([id]) => id === preset)![2]);
  const cols = COLS.filter(([k]) => shown.has(k));
  const rows = [...players].sort((a, b) => ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * (sort.desc ? -1 : 1));
  const toggle = (key: Key) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
  return (
    <>
      <div className="seg" role="tablist" aria-label="Набор показателей">
        {PRESETS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={preset === id} onClick={() => setPreset(id)}>{label}</button>))}
      </div>
      <div className="scroll">
        <table>
          <thead><tr>
            <th className="stick">Игрок</th>
            {cols.map(([k, label, hint]) => (
              <th key={k} title={hint} onClick={() => toggle(k)} className="num sortable">
                {label}{sort.key === k ? (sort.desc ? " ↓" : " ↑") : ""}
              </th>))}
          </tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slot} className={p.is_radiant ? "rad-row" : "dire-row"}>
                <td className="stick">
                  <div className="player">
                    {p.hero_img ? <img src={p.hero_img} alt="" width={44} height={25} /> : <span className="noimg" />}
                    <span><b>{p.hero_name}</b>
                      <small>{p.account_id ? <Link to={`/player/${p.account_id}`}>{who(p)}</Link> : who(p)}</small></span>
                  </div>
                </td>
                {cols.map(([k]) => <td key={k} className="num">{cell(p, k)}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
    </>
  );
}

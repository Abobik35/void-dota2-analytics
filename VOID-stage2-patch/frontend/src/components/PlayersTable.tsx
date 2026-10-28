import { useState } from "react";
import { Player } from "../api";

type Key = "kills" | "deaths" | "assists" | "kda" | "gpm" | "xpm" | "last_hits" | "denies" | "hero_damage" | "tower_damage" | "hero_healing" | "net_worth" | "slot";
const COLS: [Key, string, string][] = [
  ["kills", "K", "Убийства"], ["deaths", "D", "Смерти"], ["assists", "A", "Помощь"],
  ["kda", "KDA", "(K + A) / max(D, 1)"], ["gpm", "GPM", "Золото в минуту"], ["xpm", "XPM", "Опыт в минуту"],
  ["last_hits", "LH", "Добитые крипы"], ["denies", "DN", "Отказы"], ["hero_damage", "Урон", "Урон по героям"],
  ["tower_damage", "Башни", "Урон по зданиям"], ["hero_healing", "Лечение", "Лечение союзников"], ["net_worth", "NW", "Общая стоимость"],
];
export const fmt = (v: number | null) => (v == null ? "—" : v.toLocaleString("ru-RU"));
export const who = (p: Player) => p.name ?? (p.account_id ? `Игрок ${p.account_id}` : "Скрытый профиль");

export default function PlayersTable({ players }: { players: Player[] }) {
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "slot", desc: false });
  const rows = [...players].sort((a, b) => ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * (sort.desc ? -1 : 1));
  const toggle = (key: Key) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
  return (
    <div className="scroll">
      <table>
        <thead><tr>
          <th className="stick">Игрок</th>
          {COLS.map(([k, label, hint]) => (
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
                  <span><b>{p.hero_name}</b><small>{who(p)}</small></span>
                </div>
              </td>
              {COLS.map(([k]) => <td key={k} className="num">{k === "kda" ? p.kda.toFixed(2) : fmt(p[k] as number | null)}</td>)}
            </tr>))}
        </tbody>
      </table>
    </div>
  );
}

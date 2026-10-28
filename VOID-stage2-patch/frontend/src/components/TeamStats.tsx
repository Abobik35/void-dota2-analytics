import { useQuery } from "@tanstack/react-query";
import { getAnalytics, Team } from "../api";
import { fmt } from "./PlayersTable";

const ROWS: [keyof Team, string][] = [
  ["kills", "Убийства"], ["deaths", "Смерти"], ["assists", "Помощь"], ["last_hits", "Добитые крипы"],
  ["hero_damage", "Урон по героям"], ["tower_damage", "Урон по зданиям"], ["hero_healing", "Лечение"],
  ["net_worth", "Net worth"], ["avg_gpm", "Средний GPM"], ["avg_xpm", "Средний XPM"],
];

export default function TeamStats({ matchId }: { matchId: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["analytics", matchId], queryFn: () => getAnalytics(matchId) });
  if (isLoading) return <p className="empty">Считаю…</p>;
  if (error || !data) return <p className="err">{(error as Error)?.message}</p>;
  return (
    <div className="scroll"><table className="team">
      <thead><tr><th>Показатель</th><th className="num rad">Radiant</th><th className="num dire">Dire</th></tr></thead>
      <tbody>{ROWS.map(([k, label]) => {
        const a = data.radiant[k] as number | null, b = data.dire[k] as number | null;
        const lead = a != null && b != null && a !== b && k !== "deaths" ? (a > b ? "r" : "d") : "";
        return <tr key={k}><td>{label}</td>
          <td className={`num ${lead === "r" ? "lead" : ""}`}>{fmt(a)}</td>
          <td className={`num ${lead === "d" ? "lead" : ""}`}>{fmt(b)}</td></tr>;
      })}</tbody>
    </table></div>
  );
}

import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMatch } from "../api";
import Economy from "../components/Economy";
import PlayersTable from "../components/PlayersTable";
import TeamStats from "../components/TeamStats";

const time = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const TABS = [
  ["players", "Игроки"], ["economy", "Экономика"], ["teams", "Командная статистика"],
  ["items", "Предметы"], ["flow", "Ход матча"],
] as const;
const SOON = new Set(["items", "flow"]);

export default function MatchPage() {
  const { matchId = "" } = useParams();
  const { data, error, isLoading } = useQuery({ queryKey: ["match", matchId], queryFn: () => getMatch(matchId) });
  const [tab, setTab] = useState<string>("players");

  if (isLoading) return <p className="empty">Загружаю матч {matchId}…</p>;
  if (error || !data) return <p className="err">{(error as Error)?.message ?? "Не удалось загрузить матч."}</p>;
  const winner = data.radiant_win == null ? "Победитель неизвестен" : data.radiant_win ? "Победа Radiant" : "Победа Dire";

  return (
    <>
      <section className="match-head">
        <div>
          <h1>Матч {data.match_id}</h1>
          <p className="muted">{winner} · {time(data.duration)}
            {data.start_time && ` · ${new Date(data.start_time * 1000).toLocaleString("ru-RU")}`}</p>
        </div>
        <div className="score">
          <b className="rad">{data.radiant_score ?? "—"}</b><span>:</span><b className="dire">{data.dire_score ?? "—"}</b>
        </div>
      </section>
      {data.data_status === "basic" && (
        <p className="note">OpenDota ещё не обработал реплей этого матча: часть показателей может отсутствовать.</p>
      )}
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} disabled={SOON.has(id)}
                  title={SOON.has(id) ? "Появится на следующем этапе" : undefined}
                  className="tab" onClick={() => setTab(id)}>{label}</button>))}
      </div>
      {tab === "players" && <PlayersTable players={data.players} />}
      {tab === "economy" && <Economy matchId={matchId} players={data.players} />}
      {tab === "teams" && <TeamStats matchId={matchId} />}
    </>
  );
}

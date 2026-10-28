import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMatch } from "../api";
import ParseBanner from "../components/ParseBanner";
import FlowTab from "../components/FlowTab";
import MistakesTab from "../components/MistakesTab";
import ItemsTab from "../components/ItemsTab";
import Overview from "../components/Overview";
import Economy from "../components/Economy";
import PlayersView from "../components/PlayersView";
import TeamStats from "../components/TeamStats";

const time = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const TABS = [
  ["overview", "Обзор"], ["players", "Игроки"], ["economy", "Экономика"], ["teams", "Командная статистика"],
  ["items", "Предметы"], ["flow", "Ход матча"], ["mistakes", "Ошибки"],
] as const;
const SOON = new Set<string>();
const MODES: Record<number, string> = { 1: "All Pick", 2: "Captains Mode", 3: "Random Draft", 4: "Single Draft", 5: "All Random",
  16: "Captains Draft", 18: "Ability Draft", 21: "1v1 Mid", 22: "All Draft", 23: "Turbo", 24: "Mutation" };
const modeName = (m: number) => MODES[m] ?? `Режим #${m}`;

export default function MatchPage() {
  const { matchId = "" } = useParams();
  const { data, error, isLoading } = useQuery({ queryKey: ["match", matchId], queryFn: () => getMatch(matchId) });
  const [tab, setTab] = useState<string>("overview");

  if (isLoading) return <div className="skeleton" aria-busy="true" aria-label="Загрузка матча"><i /><i /></div>;
  if (error || !data) return <p className="err">{(error as Error)?.message ?? "Не удалось загрузить матч."}</p>;
  const winner = data.radiant_win == null ? "Победитель неизвестен" : data.radiant_win ? "Победа Radiant" : "Победа Dire";

  return (
    <>
      <section className="match-head">
        <div>
          <h1>Матч {data.match_id}</h1>
          <p className="muted">{winner} · {time(data.duration)}{data.game_mode != null && ` · ${modeName(data.game_mode)}`}
            {data.start_time && ` · ${new Date(data.start_time * 1000).toLocaleString("ru-RU")}`}</p>
        </div>
        <div className="score">
          <b className="rad">{data.radiant_score ?? "—"}</b><span>:</span><b className="dire">{data.dire_score ?? "—"}</b>
        </div>
      </section>
      {data.data_status === "basic" && <ParseBanner matchId={matchId} />}
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} disabled={SOON.has(id)}
                  title={SOON.has(id) ? "Появится на следующем этапе" : undefined}
                  className="tab" onClick={() => setTab(id)}>{label}</button>))}
      </div>
      <div key={tab} className="panel">
      {tab === "overview" && <Overview matchId={matchId} />}
      {tab === "players" && <PlayersView matchId={matchId} players={data.players} radiantWin={data.radiant_win} />}
      {tab === "economy" && <Economy matchId={matchId} players={data.players} />}
      {tab === "teams" && <TeamStats matchId={matchId} />}
      {tab === "items" && <ItemsTab matchId={matchId} />}
      {tab === "flow" && <FlowTab matchId={matchId} />}
      {tab === "mistakes" && <MistakesTab matchId={matchId} />}
      </div>
    </>
  );
}

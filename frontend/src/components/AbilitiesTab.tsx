import { useQuery } from "@tanstack/react-query";
import { getAbilities, PlayerAbilities } from "../api";
import { who } from "./PlayersTable";
import CdnImg from "./CdnImg";
import "../styles/abilities.css";

const TEAMS: [string, boolean][] = [["Radiant", true], ["Dire", false]];

function Row({ p }: { p: PlayerAbilities }) {
  return (
    <div className={`ab-row${p.is_radiant ? " rad" : " dire"}`}>
      <div className="ab-who">
        {p.hero_img ? <CdnImg src={p.hero_img} alt="" width={44} height={25} /> : <span className="noimg" />}
        <span><b>{p.hero_name}</b><small>{who(p)}</small></span>
      </div>
      <div className="ab-build">
        {p.abilities.length > 0 ? (
          <div className="ab-icons">
            {p.abilities.map((a, i) => (
              <span key={i} className="ab-ic" title={a.name}>
                {a.img
                  ? <CdnImg src={a.img} alt={a.name} width={34} height={34} loading="lazy"
                      onFail={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  : <span className="ab-fall">{a.name}</span>}
                <b aria-hidden="true">{a.level ?? ""}</b>
              </span>
            ))}
          </div>
        ) : <span className="muted ab-none">порядок прокачки недоступен</span>}
        {p.talents.length > 0 && (
          <div className="ab-talents">
            {p.talents.map((t, i) => (
              <span key={i} className="ab-tal" title={t.name}><b>{t.level}</b>{t.name}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AbilitiesTab({ matchId }: { matchId: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["abilities", matchId], queryFn: () => getAbilities(matchId) });
  if (isLoading) return <p className="empty">Загружаю способности…</p>;
  if (error || !data) return <p className="err">{(error as Error)?.message}</p>;
  const players = data.players;
  return (
    <section className="card">
      <h2>Способности и таланты</h2>
      {data.data_status === "basic" && (
        <p className="muted">Порядок прокачки есть только у обработанных матчей: сначала запросите обработку (баннер над вкладками).</p>
      )}
      <p className="muted ab-note">Номер на иконке — порядковый номер апгрейда: прокачка статов не пишется в лог, поэтому он не всегда совпадает с уровнем героя.</p>
      {TEAMS.map(([team, rad]) => {
        const rows = players.filter((p) => p.is_radiant === rad).sort((a, b) => a.slot - b.slot);
        if (!rows.length) return null;
        return (
          <div key={team}>
            <div className={`ab-team ${rad ? "radiant" : "dire"}`}><i aria-hidden="true" />{team}</div>
            {rows.map((p) => <Row key={p.slot} p={p} />)}
          </div>
        );
      })}
    </section>
  );
}

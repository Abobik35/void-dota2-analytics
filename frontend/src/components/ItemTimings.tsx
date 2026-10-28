import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getItemTimings, PlayerTimings, TimedItem } from "../api";
import { clock } from "../utils";
import { who } from "./PlayersTable";

const EVEN = 60; // секунд: в пределах минуты — «как обычно»
type Kind = "fast" | "slow" | "even" | "none";
const kind = (d: number | null): Kind => (d == null ? "none" : d <= -EVEN ? "fast" : d >= EVEN ? "slow" : "even");
const short = (d: number | null) => (d == null ? "—" : kind(d) === "even" ? "≈" : `${d < 0 ? "−" : "+"}${clock(Math.abs(d))}`);
const phrase = (d: number | null) =>
  d == null ? "нет данных для сравнения" : kind(d) === "even" ? "примерно как обычно" : `${d < 0 ? "быстрее" : "дольше"} обычного на ${clock(Math.abs(d))}`;

function Chip({ it, ready }: { it: TimedItem; ready: boolean }) {
  const hasBench = it.median != null && it.p25 != null && it.p75 != null;
  const tip = [
    `${it.name}: куплен на ${clock(it.time)} — ${phrase(it.delta)}`,
    hasBench ? `обычно ${clock(it.median!)} (половина игр — от ${clock(it.p25!)} до ${clock(it.p75!)}), игр в статистике: ${it.games}` : "",
    it.here_wr != null ? `при покупке примерно в это время win rate ${it.here_wr}% (${it.here_games} игр)` : "",
  ].filter(Boolean).join("\n");
  let track = null;
  if (hasBench) {
    const lo = Math.max(0, Math.min(it.time, it.p25!) - 150), hi = Math.max(it.time, it.p75!) + 150, span = hi - lo || 1;
    const pos = (t: number) => `${((t - lo) / span) * 100}%`;
    track = (
      <i className="tc-track" aria-hidden="true">
        <i className="band" style={{ left: pos(it.p25!), width: `${((it.p75! - it.p25!) / span) * 100}%` }} />
        <i className="med" style={{ left: pos(it.median!) }} />
        <i className={`dot ${kind(it.delta)}`} style={{ left: ready ? pos(it.time) : pos(it.median!) }} />
      </i>
    );
  }
  return (
    <div className={`tc ${kind(it.delta)}`} title={tip}>
      <span className="tc-ico">{it.img && <img src={it.img} alt={it.name} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}</span>
      <span className="tc-txt"><b>{clock(it.time)}</b><small>{short(it.delta)}</small></span>
      {track}
    </div>
  );
}

function Row({ p, ready }: { p: PlayerTimings; ready: boolean }) {
  return (
    <div className={`tr ${p.is_radiant ? "rad-row" : "dire-row"}`}>
      <div className="tr-who">
        {p.hero_img ? <img src={p.hero_img} alt="" width={36} height={20} /> : <span className="noimg" />}
        <span><b>{p.hero_name}</b><small>{who(p)}</small></span>
      </div>
      <div className="tr-items">
        {p.items.length === 0 ? <span className="muted tr-empty">нет дорогих предметов</span> : p.items.map((it) => <Chip key={it.key} it={it} ready={ready} />)}
        {p.avg_delta != null && <span className={`tr-avg ${kind(p.avg_delta)}`} title="Среднее отклонение по предметам игрока">в среднем {short(p.avg_delta)}</span>}
      </div>
    </div>
  );
}

export default function ItemTimings({ matchId, full }: { matchId: string; full: boolean }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["item-timings", matchId], queryFn: () => getItemTimings(matchId), enabled: full });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    if (!data) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, [data]);

  return (
    <section className="card">
      <h2>Тайминги ключевых предметов</h2>
      <p className="muted">Предметы от 2 000 золота: время покупки и отклонение от обычного для героя (− раньше, + позже).</p>
      {!full && <p className="note">История покупок есть только у обработанных матчей. Запросите обработку в баннере выше.</p>}
      {full && isLoading && <div className="skeleton" aria-busy="true"><i /></div>}
      {full && error && <p className="err">{(error as Error).message}</p>}
      {data && !data.available && <p className="note">{data.reason}</p>}
      {data?.available && (
        <>
          {data.highlights.length > 0 && <ul className="brief tm-brief">{data.highlights.map((h) => <li key={h}>{h}</li>)}</ul>}
          <div className="tm-cols">
            {([true, false] as const).map((rad) => (
              <div key={String(rad)} className="tm-team">
                <h3 className={rad ? "rad" : "dire"}>{rad ? "Radiant" : "Dire"}</h3>
                {data.players.filter((p) => p.is_radiant === rad).sort((a, b) => a.slot - b.slot).map((p) => <Row key={p.slot} p={p} ready={ready} />)}
              </div>))}
          </div>
          <p className="muted tm-note">
            Полоска под временем: фиолетовая — типичный диапазон (половина игр), белая черта — обычное время, точка — игрок. Наведите на предмет, чтобы увидеть подробности.
            {" "}{data.note}
          </p>
        </>)}
    </section>
  );
}

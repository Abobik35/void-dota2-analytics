import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { getMistakes, PlayerMistakes } from "../api";
import { clock } from "../utils";
import { Collapse, Disclosure } from "./Collapse";

const who = (p: { name: string | null; account_id: number | null }) =>
  p.name ?? (p.account_id ? `Игрок ${p.account_id}` : "Скрытый профиль");
const warnCount = (p: PlayerMistakes) => p.findings.filter((f) => f.severity === "warn").length;

function Chip({ label, value, hot }: { label: string; value: string | number; hot?: boolean }) {
  return <span className={`mi-chip${hot ? " hot" : ""}`}>{label} <b>{value}</b></span>;
}

function Card({ p }: { p: PlayerMistakes }) {
  const [open, setOpen] = useState(false);
  const s = p.stats, warns = warnCount(p);
  return (
    <div className={`mi ${p.is_radiant ? "rad-row" : "dire-row"}`}>
      <button type="button" className="mi-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {p.hero_img ? <img src={p.hero_img} alt="" width={56} height={32} /> : <span className="noimg big" />}
        <span className="mi-name"><b>{p.hero_name}</b><small>{who(p)}</small></span>
        <span className="mi-chips">
          <Chip label="Вне боёв" value={s.solo_deaths ?? 0} hot={(s.solo_deaths ?? 0) >= 3} />
          <Chip label="Первым погиб" value={s.first_deaths ?? 0} hot={(s.first_deaths ?? 0) >= 2} />
          <Chip label="Бай-бэки" value={`${s.buybacks ?? 0}${s.buybacks_wasted ? ` (−${s.buybacks_wasted})` : ""}`} hot={!!s.buybacks_wasted} />
          <Chip label="Простой, мин" value={s.idle_minutes ?? 0} hot={(s.idle_minutes ?? 0) >= 5} />
          {s.lane_pct != null && <Chip label="Линия" value={`${s.lane_pct}%`} />}
        </span>
        {warns > 0 && <span className="mi-badge" title="Предупреждений">{warns}</span>}
        <ChevronDown className="chev" size={18} />
      </button>
      <Collapse open={open}>
        {p.findings.length === 0 ? <p className="muted finds-empty">Заметных ошибок по данным реплея не найдено.</p> : (
          <ul className="finds">{p.findings.map((f, i) => (
            <li key={i}>
              <span className={`find-ic ${f.severity}`}>{f.severity === "warn" ? <AlertTriangle size={15} /> : <Info size={15} />}</span>
              <span className="muted">{f.time == null ? "—" : clock(f.time)}</span>
              <span>{f.text}</span>
            </li>))}</ul>)}
      </Collapse>
    </div>
  );
}

export default function MistakesTab({ matchId }: { matchId: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["mistakes", matchId], queryFn: () => getMistakes(matchId) });
  if (isLoading) return <p className="empty">Разбираю матч…</p>;
  if (error || !data) return <p className="err">{(error as Error)?.message}</p>;
  if (!data.available) return <p className="note">{data.reason} Запросите обработку в баннере выше.</p>;

  const team = (rad: boolean) => data.players.filter((p) => p.is_radiant === rad)
    .sort((a, b) => warnCount(b) - warnCount(a) || (b.stats.solo_deaths ?? 0) - (a.stats.solo_deaths ?? 0));
  return (
    <>
      <section className="card">
        <h2>Главное</h2>
        <ul className="brief">{data.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
        <p className="muted map-note">Это наблюдения по данным реплея, а не оценка игрока: у любого правила бывают исключения.</p>
      </section>
      {([true, false] as const).map((rad) => (
        <section key={String(rad)} className="card">
          <h2 className={rad ? "rad" : "dire"}>{rad ? "Radiant" : "Dire"}</h2>
          {team(rad).map((p) => <Card key={p.slot} p={p} />)}
        </section>))}
      <section className="card how">
        <Disclosure title="Как это определяется и что не учитывается">
          <ul>{data.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </Disclosure>
      </section>
    </>
  );
}

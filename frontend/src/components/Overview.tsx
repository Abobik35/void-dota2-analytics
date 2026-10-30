import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Crown } from "lucide-react";
import { getVoidRating, Mvp, RatedPlayer } from "../api";
import { Collapse, Disclosure } from "./Collapse";
import CdnImg from "./CdnImg";

const CATS: [string, string][] = [["combat", "Бой"], ["economy", "Экономика"], ["participation", "Команда"], ["objectives", "Здания"], ["utility", "Польза"]];
const ROLE = { core: "Кор", support: "Саппорт", unknown: "Роль не определена" };
const who = (p: { name: string | null; account_id: number | null }) =>
  p.name ?? (p.account_id ? `Игрок ${p.account_id}` : "Скрытый профиль");
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const signed = (v: number, d = 0) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;
const nonNull = (v: number | null | undefined): v is number => v != null;

const roleLabel = (p: RatedPlayer) => `${ROLE[p.role]}${p.position ? `, поз. ${p.position}` : ""}`;
const confLevel = (c: number): [string, string] => (c >= 0.75 ? ["high", "высокое"] : c >= 0.5 ? ["mid", "среднее"] : ["low", "низкое"]);

/** Вклад показателей в рейтинг в очках: вправо — плюс, влево — минус; сумма всех вкладов = рейтинг − 50. */
function Contribs({ items }: { items: RatedPlayer["contributions"] }) {
  if (!items.length) return null;
  const top = [...items].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 8);
  const max = Math.max(1, ...top.map((c) => Math.abs(c.points)));
  return (
    <div className="contribs" aria-label="Вклад показателей в рейтинг, очки">
      {top.map((c) => (
        <div key={c.label} className="ct" title={c.detail}>
          <span className="ct-l">{c.label}</span>
          <span className="ct-bar" aria-hidden="true"><i className={c.points >= 0 ? "pos" : "neg"} style={{ width: `${(Math.abs(c.points) / max) * 50}%` }} /></span>
          <b className={c.points >= 0 ? "pos" : "neg"}>{c.points > 0 ? "+" : ""}{c.points.toFixed(1)}</b>
        </div>))}
    </div>
  );
}

function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);
  return ready;
}

function Gauge({ value }: { value: number }) {
  const ready = useReady();
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="gauge" role="img" aria-label={`VOID Rating ${value.toFixed(1)} из 100`}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c4b5fd" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs>
        <circle cx="70" cy="70" r={R} className="g-track" />
        <circle cx="70" cy="70" r={R} className="g-fill" stroke="url(#gg)" transform="rotate(-90 70 70)"
                strokeDasharray={`${ready ? (C * value) / 100 : 0} ${C}`} />
        <line x1="70" y1="114" x2="70" y2="130" className="g-tick" />
      </svg>
      <div className="g-center"><b>{value.toFixed(1)}</b><small>VOID Rating</small></div>
    </div>
  );
}

function MvpCard({ mvp, me, others }: { mvp: Mvp; me: RatedPlayer | undefined; others: RatedPlayer[] }) {
  const ready = useReady();
  const best = others.length ? others.reduce((a, b) => (b.rating > a.rating ? b : a)) : undefined;
  const gap = me && best ? me.rating - best.rating : null;
  const avg = others.length ? mean(others.map((o) => o.rating)) : null;
  const rows = me ? CATS.flatMap(([k, label]) => {
    const v = me.categories[k], vals = others.map((o) => o.categories[k]).filter(nonNull);
    return nonNull(v) && vals.length ? [{ k, label, v, avg: mean(vals) }] : [];
  }) : [];
  const above = rows.filter((r) => r.v > r.avg).length;

  return (
    <section className="card mvp2">
      <div className="mvp2-top">
        <div className="mvp2-hero">
          {mvp.hero_img && <CdnImg src={mvp.hero_img} alt="" width={160} height={90} />}
          <span className="mvp2-badge"><Crown size={12} />MVP</span>
        </div>
        <div className="mvp2-info">
          <h2>{mvp.hero_name} <small>{who(mvp)}</small></h2>
          <ul>{mvp.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
        {mvp.rating != null && <Gauge value={mvp.rating} />}
      </div>

      {me && rows.length > 0 && (
        <>
          <div className="pills">
            {gap != null && best && (gap >= 0
              ? <span className="pill good"><b>{signed(gap, 1)}</b> над ближайшим соперником ({best.hero_name})</span>
              : <span className="pill">Лучший среди победителей; у {best.hero_name} из проигравшей команды рейтинг выше на {Math.abs(gap).toFixed(1)}</span>)}
            {avg != null && <span className="pill"><b>{signed(me.rating - avg, 1)}</b> к среднему рейтингу остальных</span>}
            <span className="pill">выше среднего по <b>{above}</b> из {rows.length} категорий</span>
          </div>
          <h3 className="cmp-title">Чем MVP превосходит остальных</h3>
          {rows.map((r) => (
            <div className="cmp" key={r.k}>
              <span className="cmp-l">{r.label}</span>
              <span className="cmp-track" aria-hidden="true">
                <i className="cmp-fill" style={{ width: `${ready ? r.v : 0}%` }} />
                <i className="cmp-mid" />
                <i className="cmp-avg" style={{ left: `${r.avg}%` }} title="Среднее остальных игроков" />
              </span>
              <span className="cmp-v"><b>{r.v.toFixed(0)}</b><small className={r.v >= r.avg ? "pos" : "neg"}>{signed(r.v - r.avg)}</small></span>
            </div>))}
          <p className="muted cmp-legend">Заливка — MVP. Белая отметка — среднее остальных игроков. Пунктир — средний уровень (50). Справа — разница со средним.</p>
        </>)}
    </section>
  );
}

function Rate({ p, rank, isMvp, cats }: { p: RatedPlayer; rank: number; isMvp: boolean; cats: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const ready = useReady();
  return (
    <div className={`rate ${p.is_radiant ? "rad-row" : "dire-row"}${isMvp ? " is-mvp" : ""}`}>
      <button type="button" className="rate-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="rank">{rank}</span>
        {p.hero_img ? <CdnImg src={p.hero_img} alt="" width={44} height={25} /> : <span className="noimg" />}
        <span className="rate-name"><b>{isMvp && <Crown size={14} className="crown" />}{p.hero_name}</b><small>{who(p)} · {roleLabel(p)}</small></span>
        <span className="rate-cats">{cats.map(([k, l]) => (
          <span key={k} title={l}><small>{l}</small>{p.categories[k] == null ? "—" : p.categories[k]!.toFixed(0)}</span>))}</span>
        <span className="rate-score"><b className="rate-total">{p.rating.toFixed(1)}</b><small title="Примерная погрешность оценки">±{Math.round(p.margin)}</small></span>
        <ChevronDown className="chev" size={18} />
        <span className="rate-meter" aria-hidden="true"><i style={{ width: `${ready ? p.rating : 0}%` }} /><b /></span>
      </button>
      <Collapse open={open}>
        <div className="why">
          <div className="conf">
            <span className={`conf-pill ${confLevel(p.confidence)[0]}`} title="Зависит от полноты данных, наличия нормы героя, размера группы и длительности матча">
              Доверие: {confLevel(p.confidence)[1]}</span>
            <span className="muted">рейтинг {p.rating.toFixed(1)} ± {Math.round(p.margin)}</span>
          </div>
          <Contribs items={p.contributions} />
          {p.positives.map((t) => <p key={t} className="pos">+ {t}</p>)}
          {p.negatives.map((t) => <p key={t} className="neg">− {t}</p>)}
          {!p.positives.length && !p.negatives.length && <p className="muted">Показатели близки к среднему для роли.</p>}
          <p className="muted">Полнота данных: {Math.round(p.completeness * 100)}%</p>
        </div>
      </Collapse>
    </div>
  );
}

export default function Overview({ matchId }: { matchId: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["void", matchId], queryFn: () => getVoidRating(matchId) });
  if (isLoading) return <p className="empty">Считаю VOID Rating…</p>;
  if (error || !data) return <p className="err">{(error as Error)?.message}</p>;
  const mvp = data.mvp;
  const me = mvp ? data.players.find((p) => p.slot === mvp.slot) : undefined;
  const others = data.players.filter((p) => p.slot !== mvp?.slot);
  const cats = data.players.some((p) => p.categories.utility != null) ? CATS : CATS.slice(0, 4);
  return (
    <>
      {mvp && <MvpCard mvp={mvp} me={me} others={others} />}
      {!data.available && <p className="note">{data.reason}</p>}
      {data.players.length > 0 && (
        <section className="card">
          <h2>VOID Rating игроков</h2>
          <p className="muted">Оценка вклада в этот матч по шкале 0–100, 50 — средний уровень для роли. Не официальный рейтинг Valve.</p>
          {data.players.map((p, i) => <Rate key={p.slot} p={p} rank={i + 1} isMvp={p.slot === mvp?.slot} cats={cats} />)}
          <div className="how">
            <Disclosure title={`Как считается рейтинг (${data.version})`}>
              <ul>{data.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
            </Disclosure>
          </div>
        </section>)}
    </>
  );
}

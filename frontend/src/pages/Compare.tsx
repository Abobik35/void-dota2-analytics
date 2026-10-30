import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Compare, CompareSide, getCompare, getMe } from "../api";
import RankBadge from "../components/RankBadge";
import CdnImg from "../components/CdnImg";
import { parseAccountId } from "../utils";

interface Row { label: string; a: number | null; b: number | null; f: (v: number) => string; lower?: boolean }
const pct = (v: number) => `${v.toFixed(1)}%`;
const d1 = (v: number) => v.toFixed(1);
const d2 = (v: number) => v.toFixed(2);
const int = (v: number) => Math.round(v).toLocaleString("ru-RU");

/** Лидер по показателю; различие меньше 3% считаем равенством, чтобы не делать выводов из шума. */
function leader(r: Row): "a" | "b" | null {
  if (r.a == null || r.b == null) return null;
  const mx = Math.max(Math.abs(r.a), Math.abs(r.b));
  if (mx === 0 || Math.abs(r.a - r.b) <= 0.03 * mx) return null;
  return (r.lower ? r.a < r.b : r.a > r.b) ? "a" : "b";
}

function Person({ s, side }: { s: CompareSide; side: "a" | "b" }) {
  const p = s.profile;
  return (
    <div className={`card cp-card ${side}`}>
      {p.avatar ? <img src={p.avatar} alt="" width={56} height={56} className="cp-av" /> : <span className="cp-av" />}
      <div className="cp-who">
        <h2><Link to={`/player/${p.account_id}`}>{p.name ?? `Игрок ${p.account_id}`}</Link></h2>
        <p className="muted">{s.analytics.sample_size} матчей в выборке</p>
      </div>
      <RankBadge rankTier={p.rank_tier} size={56} />
    </div>
  );
}

function TopHeroes({ s, title }: { s: CompareSide; title: string }) {
  return (
    <div>
      <h3 className="cp-sub">{title}</h3>
      {s.analytics.top_heroes.slice(0, 5).map((h) => (
        <div key={h.hero_id} className="cp-hero">
          {h.hero_img ? <CdnImg src={h.hero_img} alt="" width={44} height={25} /> : <span className="noimg" />}
          <b>{h.hero_name}</b><span className="muted">{h.games} матчей · {h.win_rate.toFixed(0)}%</span>
        </div>))}
      {s.analytics.top_heroes.length === 0 && <p className="muted">Нет данных.</p>}
    </div>
  );
}

function Results({ d }: { d: Compare }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, [d]);
  const pa = d.a.profile, pb = d.b.profile, sa = d.a.analytics, sb = d.b.analytics;
  const rows: Row[] = [
    { label: "Win rate в выборке", a: sa.win_rate, b: sb.win_rate, f: pct },
    { label: "Win rate за всё время", a: pa.lifetime_win_rate, b: pb.lifetime_win_rate, f: pct },
    { label: "KDA", a: sa.kda, b: sb.kda, f: d2 },
    { label: "Убийства за матч", a: sa.avg_kills, b: sb.avg_kills, f: d1 },
    { label: "Смерти за матч (меньше — лучше)", a: sa.avg_deaths, b: sb.avg_deaths, f: d1, lower: true },
    { label: "Помощь за матч", a: sa.avg_assists, b: sb.avg_assists, f: d1 },
    { label: "GPM (последние 20 матчей)", a: sa.avg_gpm, b: sb.avg_gpm, f: int },
    { label: "XPM (последние 20 матчей)", a: sa.avg_xpm, b: sb.avg_xpm, f: int },
  ];
  const leads = rows.map(leader);
  const na = leads.filter((l) => l === "a").length, nb = leads.filter((l) => l === "b").length;
  const nameA = pa.name ?? `Игрок ${pa.account_id}`, nameB = pb.name ?? `Игрок ${pb.account_id}`;

  return (
    <>
      <div className="cp-head">
        <Person s={d.a} side="a" /><span className="cp-vs">VS</span><Person s={d.b} side="b" />
      </div>
      {d.warnings.map((w) => <p key={w} className="note">{w}</p>)}

      <section className="card">
        <h2>Показатели</h2>
        <p className="muted">
          По выборке: {nameA} лидирует в {na}, {nameB} — в {nb} показателях из {rows.length}; различие меньше 3% считается равенством.
          Это сравнение цифр, а не оценка мастерства: роли, герои и режимы у игроков могут отличаться.
        </p>
        {rows.map((r, i) => {
          const mx = Math.max(r.a ?? 0, r.b ?? 0) || 1, lead = leads[i];
          return (
            <div className="duel" key={r.label}>
              <b className={`dv a${lead === "a" ? " lead" : ""}`}>{r.a == null ? "—" : r.f(r.a)}</b>
              <div className="duel-mid">
                <small>{r.label}</small>
                <span className="duel-bars" aria-hidden="true">
                  <i className="da" style={{ width: `${ready && r.a != null ? (r.a / mx) * 100 : 0}%` }} />
                  <i className="db" style={{ width: `${ready && r.b != null ? (r.b / mx) * 100 : 0}%` }} />
                </span>
              </div>
              <b className={`dv b${lead === "b" ? " lead" : ""}`}>{r.b == null ? "—" : r.f(r.b)}</b>
            </div>);
        })}
        <p className="muted cp-note">Сравнение по VOID Rating появится после того, как рейтинг начнёт сохраняться по матчам.</p>
      </section>

      <section className="card">
        <h2>Форма</h2>
        {([[nameA, d.a], [nameB, d.b]] as [string, CompareSide][]).map(([name, s]) => (
          <div key={name} className="cp-form-row">
            <span className="cp-form-name">{name}</span>
            <div className="form">{s.analytics.form.map((f) => (
              <Link key={f.match_id} to={`/match/${f.match_id}`} className={f.won == null ? "u" : f.won ? "w" : "l"} title={f.won == null ? "—" : f.won ? "Победа" : "Поражение"}>{f.won == null ? "" : f.won ? "W" : "L"}</Link>))}</div>
          </div>))}
        <p className="muted">Слева — самые новые матчи, зелёный — победа.</p>
      </section>

      <section className="card">
        <h2>Общие герои</h2>
        {d.common_heroes.length === 0 ? <p className="muted">В выборках нет героев, на которых играли оба игрока.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Герой</th><th className="num">{nameA}</th><th className="num">{nameB}</th></tr></thead>
            <tbody>{d.common_heroes.map((h) => (
              <tr key={h.hero_id}>
                <td><div className="player">{h.hero_img ? <CdnImg src={h.hero_img} alt="" width={44} height={25} /> : <span className="noimg" />}<b>{h.hero_name}</b></div></td>
                <td className="num">{h.a.games} · {h.a.win_rate.toFixed(0)}%</td>
                <td className="num">{h.b.games} · {h.b.win_rate.toFixed(0)}%</td>
              </tr>))}</tbody>
          </table></div>)}
        <p className="muted">Формат ячейки: матчей · win rate. При малом числе матчей на герое процент мало что говорит.</p>
      </section>

      <section className="card cp-heroes">
        <TopHeroes s={d.a} title={`Любимые герои: ${nameA}`} />
        <TopHeroes s={d.b} title={`Любимые герои: ${nameB}`} />
      </section>
    </>
  );
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const qa = params.get("a") ?? "", qb = params.get("b") ?? "", days = params.get("days") ?? "";
  const [ia, setIa] = useState(qa), [ib, setIb] = useState(qb), [dd, setDd] = useState(days);
  const [err, setErr] = useState("");
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 300_000 });
  useEffect(() => { if (!qa && !ia && me.data?.logged_in) setIa(String(me.data.account_id)); }, [me.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const query = useQuery({ queryKey: ["compare", qa, qb, days], queryFn: () => getCompare(qa, qb, days || undefined), enabled: !!qa && !!qb, placeholderData: keepPreviousData });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = parseAccountId(ia), b = parseAccountId(ib);
    if (!a || !b) return setErr("Введите Account ID (до 10 цифр) или SteamID64 (17 цифр) для обоих игроков.");
    if (a === b) return setErr("Выберите двух разных игроков.");
    setErr("");
    setParams({ a, b, ...(dd ? { days: dd } : {}) });
  }

  return (
    <>
      <h1>Сравнение игроков</h1>
      <p className="muted">Сравнивайте два профиля по последним матчам. Account ID виден в адресе профиля на странице игрока.</p>
      <form className="cp-form" onSubmit={submit}>
        <label>Игрок A<input value={ia} onChange={(e) => { setIa(e.target.value); setErr(""); }} inputMode="numeric" placeholder="Account ID или SteamID64" /></label>
        <label>Игрок B<input value={ib} onChange={(e) => { setIb(e.target.value); setErr(""); }} inputMode="numeric" placeholder="Account ID или SteamID64" /></label>
        <label>Период
          <select value={dd} onChange={(e) => setDd(e.target.value)}>
            <option value="">Всё время</option><option value="30">30 дней</option><option value="90">90 дней</option><option value="365">Год</option>
          </select></label>
        <button type="submit">Сравнить</button>
      </form>
      {err && <p className="err">{err}</p>}
      {query.isLoading && <div className="skeleton" aria-busy="true"><i /><i /></div>}
      {query.error && <p className="err">{(query.error as Error).message}</p>}
      {query.data && <Results d={query.data} />}
    </>
  );
}

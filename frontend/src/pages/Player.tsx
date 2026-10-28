import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import RankBadge from "../components/RankBadge";
import { parseAccountId } from "../utils";
import { Filters, getHeroes, getMe, getPlayer, getPlayerAnalytics, getPlayerMatches, refreshPlayer } from "../api";

const RANKS = ["Рекрут", "Страж", "Рыцарь", "Герой", "Легенда", "Властелин", "Божество", "Титан"];
function rankName(rt: number | null) {
  if (!rt) return null;
  const tier = Math.floor(rt / 10), star = rt % 10, name = RANKS[tier - 1];
  return name ? (tier < 8 && star ? `${name} ${star}` : name) : null;
}
const num = (v: number | null, d = 0) => (v == null ? "—" : v.toLocaleString("ru-RU", { maximumFractionDigits: d }));
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const dur = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const result = (w: boolean | null) => (w == null ? "—" : w ? "Победа" : "Поражение");

export default function PlayerPage() {
  const { accountId = "" } = useParams();
  const [days, setDays] = useState("");
  const [hero, setHero] = useState("");
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 300_000 });
  const [busy, setBusy] = useState(false);
  async function onRefresh() {
    setBusy(true);
    try { await refreshPlayer(accountId); await qc.invalidateQueries(); } finally { setBusy(false); }
  }
  const filters: Filters = { days: days || undefined, hero_id: hero || undefined };

  const profile = useQuery({ queryKey: ["player", accountId], queryFn: () => getPlayer(accountId) });
  const stats = useQuery({ queryKey: ["player-stats", accountId, filters], queryFn: () => getPlayerAnalytics(accountId, filters) });
  const heroes = useQuery({ queryKey: ["heroes"], queryFn: getHeroes, staleTime: 3600_000 });
  const list = useInfiniteQuery({
    queryKey: ["player-matches", accountId, filters],
    queryFn: ({ pageParam }) => getPlayerMatches(accountId, pageParam, filters),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next_offset ?? undefined,
  });

  if (/^\d{16,17}$/.test(accountId)) {  // SteamID64 в адресе → переходим на Account ID
    const id = parseAccountId(accountId);
    if (id) return <Navigate to={`/player/${id}`} replace />;
  }
  if (profile.isLoading) return <p className="empty">Загружаю игрока {accountId}…</p>;
  if (profile.error || !profile.data) return <p className="err">{(profile.error as Error)?.message}</p>;
  const p = profile.data, s = stats.data, rank = rankName(p.rank_tier);
  const matches = list.data?.pages.flatMap((pg) => pg.items) ?? [];

  return (
    <>
      <section className="card player-head">
        {p.avatar && <img src={p.avatar} alt="" width={72} height={72} />}
        <div>
          <h1>{p.name ?? `Игрок ${p.account_id}`}{me.data?.logged_in && me.data.account_id === p.account_id && <span className="tag win me-tag">Это вы</span>}</h1>
          <p className="muted">Account ID {p.account_id}{p.mmr_estimate ? ` · оценка MMR ≈ ${p.mmr_estimate}` : ""}</p>
          <Link className="linkish" to={`/compare?a=${p.account_id}`}>Сравнить с другим игроком</Link>
          {" · "}<button type="button" className="linkish" disabled={busy} onClick={onRefresh}>{busy ? "Обновляю…" : "Обновить данные"}</button>
        </div>
        <RankBadge rankTier={p.rank_tier} />
        <div className="lifetime">
          <b>{pct(p.lifetime_win_rate)}</b>
          <small>{p.lifetime_wins || p.lifetime_losses
            ? `${p.lifetime_wins ?? "—"} побед / ${p.lifetime_losses ?? "—"} поражений за всё время по данным OpenDota`
            : "OpenDota не видит матчей этого игрока"}</small>
        </div>
      </section>

      <div className="filters">
        <label>Период
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="">Всё время</option><option value="30">30 дней</option>
            <option value="90">90 дней</option><option value="365">Год</option>
          </select></label>
        <label>Герой
          <select value={hero} onChange={(e) => setHero(e.target.value)}>
            <option value="">Все герои</option>
            {[...(heroes.data ?? [])].sort((a, b) => a.localized_name.localeCompare(b.localized_name)).map((h) =>
              <option key={h.id} value={h.id}>{h.localized_name}</option>)}
          </select></label>
      </div>

      {stats.error && <p className="err">{(stats.error as Error).message}</p>}
      {s && (s.sample_size === 0
        ? <p className="note">{days || hero
          ? "Матчей по выбранным фильтрам не найдено."
          : "OpenDota не вернул ни одного матча этого игрока. Скорее всего, в Dota 2 закрыт доступ к данным матчей (настройка «Expose Public Match Data») или OpenDota ещё не загрузил историю игрока. Нажмите «Обновить данные» в шапке профиля."}</p>
        : <>
          <p className="muted">Выборка: {s.sample_size} последних матчей с учётом фильтров, а не вся история игрока.</p>
          <div className="stat-grid">
            <div className="stat"><small>Win rate</small><b>{pct(s.win_rate)}</b><span>{s.wins} / {s.losses}</span></div>
            <div className="stat"><small>KDA</small><b>{num(s.kda, 2)}</b><span>{num(s.avg_kills, 1)} / {num(s.avg_deaths, 1)} / {num(s.avg_assists, 1)}</span></div>
            <div className="stat"><small>GPM</small><b>{num(s.avg_gpm)}</b><span>по {s.gpm_sample} матчам</span></div>
            <div className="stat"><small>XPM</small><b>{num(s.avg_xpm)}</b><span>по {s.gpm_sample} матчам</span></div>
          </div>
          <p className="muted">GPM и XPM есть только у последних 20 матчей, поэтому усредняются по ним.</p>
          <section className="card"><h2>Форма</h2>
            <div className="form">{s.form.map((f) => (
              <Link key={f.match_id} to={`/match/${f.match_id}`} title={result(f.won)}
                    className={f.won == null ? "u" : f.won ? "w" : "l"} />))}</div>
            <p className="muted">Слева — самые новые матчи.</p></section>
          <section className="card"><h2>Герои в выборке</h2>
            <div className="scroll"><table><thead><tr><th>Герой</th><th className="num">Матчи</th><th className="num">Победы</th><th className="num">Win rate</th></tr></thead>
              <tbody>{s.top_heroes.map((h) => (
                <tr key={h.hero_id}><td><div className="player">
                  {h.hero_img ? <img src={h.hero_img} alt="" width={44} height={25} /> : <span className="noimg" />}<b>{h.hero_name}</b></div></td>
                  <td className="num">{h.games}</td><td className="num">{h.wins}</td><td className="num">{pct(h.win_rate)}</td></tr>))}
              </tbody></table></div></section>
        </>)}

      <section className="card"><h2>История матчей</h2>
        {list.isLoading && <p className="empty">Загружаю матчи…</p>}
        {list.error && <p className="err">{(list.error as Error).message}</p>}
        {matches.length > 0 && (
          <div className="scroll"><table>
            <thead><tr><th>Результат</th><th>Герой</th><th>Дата</th><th className="num">Время</th><th className="num">K/D/A</th>
              <th className="num">KDA</th><th className="num">GPM</th><th className="num">XPM</th><th /></tr></thead>
            <tbody>{matches.map((m) => (
              <tr key={m.match_id} className={m.won == null ? "" : m.won ? "rad-row" : "dire-row"}>
                <td>{result(m.won)}</td>
                <td><div className="player">{m.hero_img ? <img src={m.hero_img} alt="" width={44} height={25} /> : <span className="noimg" />}<b>{m.hero_name}</b></div></td>
                <td>{m.start_time ? new Date(m.start_time * 1000).toLocaleDateString("ru-RU") : "—"}</td>
                <td className="num">{dur(m.duration)}</td><td className="num">{m.kills}/{m.deaths}/{m.assists}</td>
                <td className="num">{m.kda.toFixed(2)}</td><td className="num">{num(m.gpm)}</td><td className="num">{num(m.xpm)}</td>
                <td><Link to={`/match/${m.match_id}`}>Разбор</Link></td></tr>))}
            </tbody></table></div>)}
        {list.hasNextPage && <button className="more" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
          {list.isFetchingNextPage ? "Загружаю…" : "Показать ещё"}</button>}
      </section>
    </>
  );
}

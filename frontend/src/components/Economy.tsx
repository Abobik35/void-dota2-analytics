import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getTimeline, Player } from "../api";
import { fmt, who } from "./PlayersTable";
import CdnImg from "./CdnImg";

function Bars({ players, side }: { players: Player[]; side: boolean }) {
  const team = players.filter((p) => p.is_radiant === side);
  const max = Math.max(1, ...players.map((p) => p.net_worth ?? 0));
  return (
    <div className="bars">
      <h3 className={side ? "rad" : "dire"}>{side ? "Radiant" : "Dire"}</h3>
      {team.map((p) => (
        <div key={p.slot} className="bar-row" title={`Net worth: ${fmt(p.net_worth)}`}>
          <span className="bar-name">
            {p.hero_img ? <CdnImg src={p.hero_img} alt="" width={44} height={25} loading="lazy" onFail={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="noimg" />}
            <span className="bar-text"><b>{p.hero_name}</b><small>{who(p)}</small></span>
          </span>
          <span className="bar-track"><i className={side ? "fill-r" : "fill-d"} style={{ width: `${((p.net_worth ?? 0) / max) * 100}%` }} /></span>
          <span className="num">{fmt(p.net_worth)}</span>
        </div>))}
    </div>
  );
}

export default function Economy({ matchId, players }: { matchId: string; players: Player[] }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["timeline", matchId], queryFn: () => getTimeline(matchId) });
  const rows = data?.available ? data.minutes.map((m, i) => ({ m, gold: data.gold_adv[i], xp: data.xp_adv[i] })) : [];
  return (
    <>
      <section className="card">
        <h2>Преимущество по минутам</h2>
        <p className="muted">Выше нуля — лидирует Radiant, ниже — Dire. Данные OpenDota, без сглаживания.</p>
        {isLoading && <p className="empty">Загружаю график…</p>}
        {error && <p className="err">{(error as Error).message}</p>}
        {data && !data.available && <p className="note">{data.reason}</p>}
        {rows.length > 0 && (
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
                <XAxis dataKey="m" stroke="#929292" tickFormatter={(v) => `${v}′`} />
                <YAxis stroke="#929292" tickFormatter={(v) => `${v / 1000}k`} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,.3)" />
                <Tooltip contentStyle={{ background: "#151515", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }}
                         labelFormatter={(v) => `${v}-я минута`} formatter={(v: number, n) => [v.toLocaleString("ru-RU"), n === "gold" ? "Золото" : "Опыт"]} />
                <Line type="monotone" dataKey="gold" stroke="#a78bfa" strokeWidth={2} dot={false} />
                {data!.xp_adv.length > 0 && <Line type="monotone" dataKey="xp" stroke="#7a8794" strokeWidth={2} dot={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>)}
        {rows.length > 0 && <p className="muted"><span className="dot v" /> золото <span className="dot g" /> опыт</p>}
      </section>
      <section className="card">
        <h2>Net worth игроков</h2>
        <div className="bars-2"><Bars players={players} side /><Bars players={players} side={false} /></div>
      </section>
    </>
  );
}

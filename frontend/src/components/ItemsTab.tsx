import { useQuery } from "@tanstack/react-query";
import { getItems, ItemRef, PlayerItems } from "../api";
import { clock } from "../utils";
import { Disclosure } from "./Collapse";
import ItemTimings from "./ItemTimings";
import { who } from "./PlayersTable";

function Icon({ item, small }: { item: ItemRef | null; small?: boolean }) {
  const title = item ? `${item.name}${item.cost ? ` · ${item.cost} золота` : ""}` : "Пусто";
  return (
    <span className={`item${small ? " sm" : ""}${item ? "" : " empty"}`} title={title}>
      {item?.img && <img src={item.img} alt={item.name} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
    </span>
  );
}
const Hero = ({ p }: { p: PlayerItems }) => (
  <div className="player">
    {p.hero_img ? <img src={p.hero_img} alt="" width={44} height={25} /> : <span className="noimg" />}
    <span><b>{p.hero_name}</b><small>{who(p)}</small></span>
  </div>
);

export default function ItemsTab({ matchId }: { matchId: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["items", matchId], queryFn: () => getItems(matchId) });
  if (isLoading) return <p className="empty">Загружаю предметы…</p>;
  if (error || !data) return <p className="err">{(error as Error)?.message}</p>;
  const players = [...data.players].sort((a, b) => a.slot - b.slot);
  const full = data.data_status === "full";

  return (
    <>
      <section className="card">
        <h2>Предметы на конец матча</h2>
        <p className="muted">Инвентарь в момент окончания игры, а не история покупок: проданные и разобранные предметы здесь не видны.</p>
        <div className="scroll"><table>
          <thead><tr><th className="stick">Игрок</th><th>Основные</th><th>Рюкзак</th><th>Нейтральный</th></tr></thead>
          <tbody>{players.map((p) => (
            <tr key={p.slot} className={p.is_radiant ? "rad-row" : "dire-row"}>
              <td className="stick"><Hero p={p} /></td>
              <td><div className="items-row">{p.main.map((it, i) => <Icon key={i} item={it} />)}</div></td>
              <td><div className="items-row">{p.backpack.map((it, i) => <Icon key={i} item={it} small />)}</div></td>
              <td><Icon item={p.neutral} /></td>
            </tr>))}</tbody>
        </table></div>
      </section>

      <ItemTimings matchId={matchId} full={full} />

      {full && (
        <section className="card">
          <h2>Вся история покупок</h2>
          {players.map((p) => (
            <Disclosure key={p.slot} title={`${p.hero_name} · ${who(p)} (${p.purchases?.length ?? 0})`}>
              <ul className="purchases">{(p.purchases ?? []).map((x, i) => (
                <li key={i}><span className="muted">{clock(x.time)}</span> {x.name}{x.cost ? <span className="muted"> · {x.cost}</span> : null}</li>))}</ul>
            </Disclosure>))}
        </section>)}
    </>
  );
}

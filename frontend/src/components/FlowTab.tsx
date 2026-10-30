import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Coins, Crown, Pause, Play, Swords } from "lucide-react";
import { EventHero, FlowEvent, getFlow, Side } from "../api";
import { clock } from "../utils";
import MatchMap, { Layers, useMapImage } from "./MatchMap";
import CdnImg from "./CdnImg";

const SIDE: Record<Side, string> = { radiant: "Radiant", dire: "Dire" };
const TYPES: [FlowEvent["type"], string][] = [["kill", "Убийства"], ["building", "Здания"], ["roshan", "Рошан"], ["buyback", "Бай-бэки"]];
const PHASES = ["Лайнинг · до 10:00", "Середина игры · 10:00–30:00", "Поздняя игра · после 30:00"];
const phase = (s: number) => (s < 600 ? 0 : s < 1800 ? 1 : 2);
const num = (v: number) => v.toLocaleString("ru-RU");
const signed = (v: number) => `${v > 0 ? "+" : ""}${num(v)}`;
const ICON = { kill: Swords, building: Building2, roshan: Crown, buyback: Coins };

const Who = ({ h }: { h: EventHero | null }) => h ? (
  <span className={`who ${h.team ?? ""}`}>
    {h.img && <CdnImg src={h.img} alt="" width={26} height={15} loading="lazy" onFail={(e) => { e.currentTarget.style.display = "none"; }} />}{h.name}
  </span>) : null;

function EventRow({ e, onSeek }: { e: FlowEvent; onSeek: (t: number) => void }) {
  const Icon = ICON[e.type];
  return (
    <button type="button" className="ev" onClick={() => onSeek(e.time)} aria-label={`${clock(e.time)}: ${e.text}. Показать на карте`}>
      <span className="muted">{clock(e.time)}</span>
      <span className={`ev-ic ${e.team ?? ""}`}><Icon size={14} /></span>
      <span className="ev-text">
        {e.type === "kill" ? <><Who h={e.actor} /> <span className="muted">убил</span> <Who h={e.target} /></>
          : e.type === "buyback" ? <><Who h={e.actor} /> <span className="muted">купил возрождение</span></>
          : e.text}
      </span>
    </button>
  );
}

export default function FlowTab({ matchId }: { matchId: string }) {
  const { data, error, isLoading } = useQuery({ queryKey: ["flow", matchId], queryFn: () => getFlow(matchId) });
  const [t, setT] = useState<number | null>(null); // null — конец матча
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [layers, setLayers] = useState<Layers>({ wards: true, deaths: true, buildings: true, lane: false });
  const [types, setTypes] = useState<Set<string>>(new Set(["kill", "building", "roshan", "buyback"]));
  const mapRef = useRef<HTMLElement>(null);
  const mapSrc = useMapImage();

  const end = data?.available ? (data.duration ?? data.events.reduce((a, e) => Math.max(a, e.time), 0)) : 0;
  const cur = Math.min(t ?? end, end);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setT((p) => Math.min(end, (p ?? 0) + 3 * speed)), 100);
    return () => window.clearInterval(id);
  }, [playing, speed, end]);
  useEffect(() => { if (playing && cur >= end) setPlaying(false); }, [playing, cur, end]);

  if (isLoading) return <p className="empty">Загружаю ход матча…</p>;
  if (error || !data) return <p className="err">{(error as Error)?.message}</p>;
  if (!data.available) return <p className="note">{data.reason} Запросите обработку в баннере выше.</p>;

  const play = () => { if (playing) return setPlaying(false); if (cur >= end) setT(0); setPlaying(true); };
  const seek = (s: number) => { setPlaying(false); setT(Math.max(0, Math.min(end, s))); mapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const toggleType = (k: string) => setTypes((s) => { const c = new Set(s); if (c.has(k)) c.delete(k); else c.add(k); return c; });
  const toggleLayer = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const events = data.events.filter((e) => types.has(e.type));
  const bloodiest = data.teamfights.reduce((a, f) => (f.deaths > a ? f.deaths : a), 0);
  const pos = (s: number) => `${end ? (s / end) * 100 : 0}%`;
  const anyEstimated = data.wards.some((w) => w.estimated);

  return (
    <>
      {data.summary.length > 0 && (
        <section className="card">
          <h2>Коротко о матче</h2>
          <ul className="brief">{data.summary.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>)}

      <section className="card" ref={mapRef}>
        <h2>Карта матча</h2>
        <p className="muted">Двигайте ползунок или нажмите «Воспроизвести»: варды, смерти в боях и разрушенные здания показаны на выбранный момент.</p>
        <div className="map-controls">
          <button type="button" className="play" onClick={play}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Пауза" : "Воспроизвести"}</button>
          <div className="seg" role="tablist" aria-label="Скорость">
            {[1, 2, 4].map((v) => <button key={v} role="tab" aria-selected={speed === v} onClick={() => setSpeed(v)}>×{v}</button>)}
          </div>
          <span className="clock">{clock(cur)} <span className="muted">/ {clock(end)}</span></span>
        </div>
        <input type="range" className="scrub" min={0} max={end} step={1} value={cur} aria-label="Время матча"
               onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} />
        <div className="marks" aria-hidden="true">
          {data.teamfights.map((f, i) => <span key={`f${i}`} className="mk tf" style={{ left: pos(f.start ?? 0) }} />)}
          {data.buildings.map((b, i) => <span key={`b${i}`} className={`mk bd ${b.owner === "radiant" ? "dire" : "radiant"}`} style={{ left: pos(b.time) }} />)}
          {data.events.filter((e) => e.type === "roshan").map((e, i) => <span key={`r${i}`} className="mk ro" style={{ left: pos(e.time) }} />)}
        </div>
        <div className="evfilters">
          {([["wards", "Варды"], ["deaths", "Смерти в боях"], ["buildings", "Здания"], ["lane", "Позиции в начале игры"]] as [keyof Layers, string][]).map(([k, label]) => (
            <label key={k}><input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} /> {label}</label>))}
        </div>
        <MatchMap flow={data} t={cur} layers={layers} mapSrc={mapSrc} />
        {!mapSrc && (
          <p className="muted map-note">Сейчас показана схема. Чтобы увидеть настоящую карту Dota 2, положите квадратное изображение карты в папку
            <code>frontend/public</code> под именем <code>dota-map.jpg</code> и обновите страницу.</p>)}
        <p className="muted map-note">
          {mapSrc ? "Варды, смерти и позиции размещены по координатам реплея, здания — приблизительно." : "Схема не в масштабе: варды, смерти и позиции размещены по координатам реплея, здания — условно по линиям."}
          Смерти показаны только из командных боёв.{anyEstimated && " Если реплей не сообщил, когда вард исчез, срок жизни оценён (6 мин для наблюдателя, 8 для сентри)."}
          <br /><span className="mk-legend"><i className="mk tf" /> бой <i className="mk bd" /> здание <i className="mk ro" /> Рошан</span>
        </p>
      </section>

      {data.turning_points.length > 0 && (
        <section className="card">
          <h2>Поворотные моменты</h2>
          <p className="muted">Самые резкие изменения преимущества по золоту за две минуты. Это производный показатель по графику на вкладке «Экономика».</p>
          <ul className="turns">{data.turning_points.map((p) => (
            <li key={p.minute}>
              <button type="button" className="linkish" onClick={() => seek(p.minute * 60)}>{p.minute}-я минута</button>
              <span>Золото сместилось в пользу <b className={p.team === "radiant" ? "rad" : "dire"}>{SIDE[p.team]}</b> на {num(Math.abs(p.delta))}.</span>
              <span className="muted">Преимущество Radiant: {signed(p.from_adv)} → {signed(p.to_adv)}</span>
            </li>))}</ul>
        </section>)}

      {data.teamfights.length > 0 && (
        <section className="card">
          <h2>Командные бои</h2>
          <p className="muted">Исход определяется по числу потерь: у кого погибших меньше, тот выиграл обмен.</p>
          <div className="scroll"><table>
            <thead><tr><th>#</th><th>Время</th><th className="num">Смертей</th><th className="num">Потери R / D</th><th className="num">Золото R / D</th><th>Исход</th></tr></thead>
            <tbody>{data.teamfights.map((f, i) => (
              <tr key={i} className={f.deaths === bloodiest && bloodiest > 0 ? "hot" : ""}>
                <td className="muted">{i + 1}</td>
                <td><button type="button" className="linkish" onClick={() => seek(f.start ?? 0)}>{clock(f.start)}–{clock(f.end)}</button></td>
                <td className="num">{f.deaths}{f.deaths === bloodiest && bloodiest > 0 && <span className="tag">самый кровавый</span>}</td>
                <td className="num"><span className="rad">{f.radiant_deaths}</span> / <span className="dire">{f.dire_deaths}</span></td>
                <td className="num"><span className="rad">{signed(f.radiant_gold_delta)}</span> / <span className="dire">{signed(f.dire_gold_delta)}</span></td>
                <td className={f.outcome === "radiant" ? "rad" : f.outcome === "dire" ? "dire" : ""}>
                  {f.outcome === "draw" ? "Равный обмен" : `Выиграл ${SIDE[f.outcome]}`}</td></tr>))}</tbody>
          </table></div>
        </section>)}

      <section className="card">
        <h2>События матча</h2>
        <p className="muted">Нажмите на событие, чтобы увидеть момент на карте.</p>
        <div className="evfilters">{TYPES.map(([k, label]) => (
          <label key={k}><input type="checkbox" checked={types.has(k)} onChange={() => toggleType(k)} /> {label}</label>))}</div>
        {events.length === 0 ? <p className="muted">Нет событий выбранных типов.</p> : (
          <div className="events">{events.map((e, i) => (
            <div key={i}>
              {(i === 0 || phase(events[i - 1].time) !== phase(e.time)) && <h3 className="phase">{PHASES[phase(e.time)]}</h3>}
              <EventRow e={e} onSeek={seek} />
            </div>))}</div>)}
      </section>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { BuildingEvent, Flow, Side } from "../api";
import { clock } from "../utils";

export interface Layers { wards: boolean; deaths: boolean; buildings: boolean; lane: boolean }
const COLOR: Record<Side, string> = { radiant: "#4ade80", dire: "#f87171" };
const SIDE_RU: Record<Side, string> = { radiant: "Radiant", dire: "Dire" };
const LANE: Record<string, string> = { top: "верх", mid: "центр", bot: "низ" };
type Pos = [number, number];
const rot = ([x, y]: Pos): Pos => [1000 - x, 1000 - y]; // Dire — зеркально повёрнутая Radiant

/** Настоящая карта Dota 2: положите изображение в frontend/public под одним из этих имён. */
const MAP_FILES = ["/dota-map.jpg", "/dota-map.jpeg", "/dota-map.png", "/dota-map.webp"];
export function useMapImage(): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const f of MAP_FILES) {
        const ok = await new Promise<boolean>((res) => {
          const im = new Image();
          im.onload = () => res(im.naturalWidth > 100);
          im.onerror = () => res(false); // dev-сервер на отсутствующий файл отдаёт HTML — это тоже ошибка картинки
          im.src = f;
        });
        if (ok && alive) { setSrc(f); return; }
      }
    })();
    return () => { alive = false; };
  }, []);
  return src;
}
/** Подгонка меток под вашу картинку карты: k — масштаб от центра, dx/dy — сдвиг в единицах схемы (0–1000). */
const CAL = { k: 1, dx: 0, dy: 0 };

interface Spec { kind: BuildingEvent["kind"]; tier: number | null; lane: string | null; variant: string | null; pos: Pos; label: string }
const tower = (tier: number, lane: string, pos: Pos): Spec => ({ kind: "tower", tier, lane, variant: null, pos, label: `Башня ${tier}` });
const rax = (lane: string, variant: string, pos: Pos): Spec =>
  ({ kind: "rax", tier: null, lane, variant, pos, label: `Казармы (${variant === "melee" ? "ближний бой" : "дальний бой"})` });
// Позиции зданий условные (по линиям схемы), не координаты реплея.
const SPECS: Spec[] = [
  tower(1, "top", [130, 400]), tower(2, "top", [130, 540]), tower(3, "top", [130, 670]),
  tower(1, "mid", [430, 570]), tower(2, "mid", [350, 650]), tower(3, "mid", [275, 725]),
  tower(1, "bot", [610, 870]), tower(2, "bot", [470, 870]), tower(3, "bot", [340, 870]),
  { kind: "tower", tier: 4, lane: null, variant: "a", pos: [200, 830], label: "Башня 4" },
  { kind: "tower", tier: 4, lane: null, variant: "b", pos: [170, 862], label: "Башня 4" },
  rax("top", "melee", [118, 770]), rax("top", "range", [142, 770]),
  rax("mid", "melee", [222, 775]), rax("mid", "range", [245, 798]),
  rax("bot", "melee", [255, 872]), rax("bot", "range", [255, 898]),
  { kind: "ancient", tier: null, lane: null, variant: null, pos: [120, 880], label: "Трон" },
];
const skey = (s: { kind: string; tier: number | null; lane: string | null; variant: string | null }) =>
  `${s.kind}|${s.tier ?? ""}|${s.lane ?? ""}|${s.variant ?? ""}`;

function destroyedAt(buildings: BuildingEvent[]) {
  const m = new Map<string, number>();
  const t4: Record<string, number> = { radiant: 0, dire: 0 };
  for (const b of [...buildings].sort((a, c) => a.time - c.time)) {
    const tier4 = b.kind === "tower" && b.tier === 4;
    const variant = tier4 ? (t4[b.owner]++ === 0 ? "a" : "b") : b.variant;
    m.set(`${b.owner}:${skey({ kind: b.kind, tier: b.tier, lane: tier4 ? null : b.lane, variant })}`, b.time);
  }
  return m;
}

/** Диапазон координат реплея: либо 64–192, либо 0–128 (если все значения небольшие). */
function domain(flow: Flow): [number, number] {
  const v = [...flow.wards, ...flow.deaths, ...flow.lane_heat].flatMap((p) => [p.x, p.y]);
  return v.length && v.reduce((a, b) => Math.max(a, b), 0) <= 130 ? [0, 128] : [64, 192];
}

export default function MatchMap({ flow, t, layers, mapSrc }: { flow: Flow; t: number; layers: Layers; mapSrc: string | null }) {
  const [lo, hi] = useMemo(() => domain(flow), [flow]);
  const destroyed = useMemo(() => destroyedAt(flow.buildings), [flow.buildings]);
  const maxHeat = useMemo(() => flow.lane_heat.reduce((a, h) => Math.max(a, h.w), 1), [flow.lane_heat]);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const M = mapSrc ? 0 : 30, S = 1000 - 2 * M;
  const P = (x: number, y: number): Pos => {
    const px = M + clamp((x - lo) / (hi - lo)) * S, py = M + (1 - clamp((y - lo) / (hi - lo))) * S;
    return [500 + (px - 500) * CAL.k + CAL.dx, 500 + (py - 500) * CAL.k + CAL.dy];
  };

  return (
    <svg viewBox="0 0 1000 1000" className="map-svg" role="img" aria-label="Схема карты: варды, смерти в боях и здания на выбранный момент матча">
      <defs>
        <radialGradient id="g-rad"><stop offset="0" stopColor="#4ade80" stopOpacity=".26" /><stop offset="1" stopColor="#4ade80" stopOpacity="0" /></radialGradient>
        <radialGradient id="g-dire"><stop offset="0" stopColor="#f87171" stopOpacity=".26" /><stop offset="1" stopColor="#f87171" stopOpacity="0" /></radialGradient>
      </defs>
      {mapSrc ? (
        <>
          <clipPath id="map-clip"><rect width="1000" height="1000" rx="28" /></clipPath>
          <g clipPath="url(#map-clip)">
            <image href={mapSrc} x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid slice" />
            <rect width="1000" height="1000" fill="#000" opacity=".28" />
          </g>
          <rect width="1000" height="1000" rx="28" fill="none" className="map-bg" />
        </>
      ) : (
        <>
          <rect width="1000" height="1000" rx="28" className="map-bg" />
          <circle cx="150" cy="850" r="280" fill="url(#g-rad)" />
          <circle cx="850" cy="150" r="280" fill="url(#g-dire)" />
          <path d="M70,70 L930,930" className="map-river" />
          <g className="map-lanes">
            <path d="M130,860 L130,140 Q130,110 160,110 L860,110" />
            <path d="M140,870 L860,870 Q890,870 890,840 L890,140" />
            <path d="M150,850 L850,150" />
          </g>
        </>
      )}
      <text x="40" y="975" className="map-label rad">RADIANT</text>
      <text x="960" y="45" textAnchor="end" className="map-label dire">DIRE</text>

      {layers.lane && flow.lane_heat.map((h, i) => {
        const [x, y] = P(h.x, h.y);
        return <circle key={i} cx={x} cy={y} r="12" fill={COLOR[h.team]} opacity={0.08 + 0.4 * (h.w / maxHeat)} />;
      })}

      {layers.buildings && (["radiant", "dire"] as Side[]).flatMap((owner) => SPECS.map((s) => {
        const [x, y] = owner === "radiant" ? s.pos : rot(s.pos);
        const at = destroyed.get(`${owner}:${skey(s)}`);
        const dead = at !== undefined && at <= t;
        const recent = dead && t - (at as number) < 20;
        const size = s.kind === "ancient" ? 24 : s.kind === "tower" ? 16 : 11;
        const title = `${s.label}${s.lane ? ` (${LANE[s.lane]})` : ""} · ${SIDE_RU[owner]}${dead ? ` — уничтожено на ${clock(at as number)}` : ""}`;
        return (
          <g key={`${owner}-${skey(s)}`} transform={`translate(${x} ${y})`}>
            <title>{title}</title>
            {dead
              ? <path d="M-8,-8L8,8M8,-8L-8,8" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" opacity=".7" />
              : <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={s.kind === "ancient" ? 6 : 3}
                      fill={COLOR[owner]} fillOpacity=".75" stroke="#0b0b0f" strokeWidth="2" />}
            {recent && <circle r="14" fill="none" stroke={COLOR[owner]} strokeWidth="3" className="pulse" />}
          </g>);
      }))}

      {layers.wards && flow.wards.filter((w) => w.time <= t && t < w.until).map((w, i) => {
        const [x, y] = P(w.x, w.y), c = COLOR[w.team], obs = w.kind === "obs";
        return (
          <g key={i}>
            <title>{`${obs ? "Наблюдатель" : "Сентри"} · ${SIDE_RU[w.team]} · с ${clock(w.time)}${w.estimated ? " (срок жизни оценён)" : ` до ${clock(w.until)}`}`}</title>
            <circle cx={x} cy={y} r={obs ? 78 : 52} fill={c} fillOpacity=".06" stroke={c} strokeOpacity=".3" strokeDasharray={obs ? undefined : "6 6"} />
            <circle cx={x} cy={y} r={obs ? 7 : 5} fill={obs ? c : "none"} stroke={c} strokeWidth="2.5" />
          </g>);
      })}

      {layers.deaths && flow.deaths.filter((d) => d.time <= t).map((d, i) => {
        const [x, y] = P(d.x, d.y);
        return (
          <g key={i} opacity={Math.max(0.3, 1 - (t - d.time) / 900)} stroke={COLOR[d.team]} strokeWidth="4" strokeLinecap="round">
            <title>{`Погиб игрок ${SIDE_RU[d.team]} · бой с ${clock(d.time)}${d.count > 1 ? ` · ×${d.count}` : ""}`}</title>
            <path d={`M${x - 9},${y - 9}L${x + 9},${y + 9}M${x + 9},${y - 9}L${x - 9},${y + 9}`} stroke="#000" strokeOpacity=".55" strokeWidth="8" />
            <path d={`M${x - 9},${y - 9}L${x + 9},${y + 9}M${x + 9},${y - 9}L${x - 9},${y + 9}`} />
          </g>);
      })}
    </svg>
  );
}

import { useState } from "react";

const RANKS = ["Рекрут", "Страж", "Рыцарь", "Герой", "Легенда", "Властелин", "Божество", "Титан"];
const COLORS = ["#6b7280", "#a07850", "#6fa86a", "#7a8aa0", "#8a6fd0", "#d9a441", "#43b0b5", "#6d9cf2", "#ef5350"];
const NUMERALS = ["?", "I", "II", "III", "IV", "V", "VI", "VII", "★"];
const BASE = "https://www.opendota.com/assets/images/dota2/rank_icons";

export function rankName(rt: number | null): string {
  if (!rt) return "Ранг не определён";
  const tier = Math.floor(rt / 10), star = rt % 10, name = RANKS[tier - 1];
  return name ? (tier < 8 && star ? `${name} ${star}` : name) : "Ранг не определён";
}

/** Запасная медаль, если картинка ранга недоступна. Нарисована для VOID, не является оригинальным значком Valve. */
function Medal({ tier, star, label }: { tier: number; star: number; label: string }) {
  const color = COLORS[tier] ?? COLORS[0];
  return (
    <svg viewBox="0 0 100 100" className="rank-svg" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`rg-${tier}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity=".5" />
        </linearGradient>
      </defs>
      <path d="M50 6 L88 24 V58 C88 78 70 90 50 96 C30 90 12 78 12 58 V24 Z" fill={`url(#rg-${tier})`} stroke="rgba(255,255,255,.55)" strokeWidth="3" />
      <path d="M50 18 L76 30 V56 C76 70 64 79 50 84 C36 79 24 70 24 56 V30 Z" fill="rgba(0,0,0,.28)" stroke="rgba(255,255,255,.25)" strokeWidth="2" />
      <text x="50" y="58" textAnchor="middle" fontSize="30" fontWeight="700" fill="#fff" fontFamily="Sora, Inter, sans-serif">{NUMERALS[tier] ?? "?"}</text>
      {tier > 0 && tier < 8 && [0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={30 + i * 10} cy="73" r="3.2" fill="#fff" opacity={i < star ? 0.95 : 0.22} />))}
    </svg>
  );
}

/** Значок ранга Dota 2 вместо текстового названия. Название остаётся в подсказке и для скринридеров. */
export default function RankBadge({ rankTier, size = 88 }: { rankTier: number | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const tier = rankTier ? Math.floor(rankTier / 10) : 0, star = rankTier ? rankTier % 10 : 0;
  const label = rankName(rankTier), valid = tier >= 1 && tier <= 8;
  return (
    <span className="rank-badge" style={{ width: size, height: size, ["--rc" as string]: COLORS[valid ? tier : 0] }} title={label}>
      {valid && !failed ? (
        <>
          <img src={`${BASE}/rank_icon_${tier}.png`} alt={label} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
          {tier < 8 && star >= 1 && star <= 5 && (
            <img className="rank-star" src={`${BASE}/rank_star_${star}.png`} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />)}
        </>
      ) : <Medal tier={valid ? tier : 0} star={star} label={label} />}
    </span>
  );
}

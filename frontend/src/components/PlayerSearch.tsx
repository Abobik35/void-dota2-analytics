import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, User } from "lucide-react";
import { searchPlayers } from "../api";
import RankBadge from "./RankBadge";

/**
 * Поиск игрока по нику в шапке debounced запрос к /search, навигация на профиль
 * по клику мыши или Enter на выбранной подсказке.
 */
export default function PlayerSearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const { data, isFetching, error } = useQuery({
    queryKey: ["psearch", debounced],
    queryFn: () => searchPlayers(debounced),
    enabled: debounced.length >= 2,
    placeholderData: (prev) => prev,
  });
  const items = data?.players ?? [];

  useEffect(() => { if (debounced.length >= 2) { setOpen(true); } setIdx(-1); }, [debounced]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(id: number) {
    setQ(""); setDebounced(""); setOpen(false); setIdx(-1);
    navigate(`/player/${id}`);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); setOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && open && idx >= 0 && items[idx]) go(items[idx].account_id);
    else if (e.key === "Escape") { setOpen(false); setIdx(-1); }
  }
  // dropdown прячем только когда закрыли вручную или пустой запрос; данные держим, чтобы не мигало
  const visible = open && debounced.length >= 2 && (items.length > 0 || isFetching || error);

  return (
    <div className="pgs" ref={box}>
      <Search className="pgs-ic" size={15} aria-hidden="true" />
      <input
        type="text" value={q} placeholder="Поиск игрока…"
        onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length >= 2) { setOpen(true); setIdx(-1); } }}
        onFocus={() => { if (debounced.length >= 2) setOpen(true); }}
        onBlur={() => setIdx(-1)}
        onKeyDown={onKey}
        aria-label="Поиск игрока по нику" autoComplete="off" spellCheck={false}
      />
      {visible && (
        <div className="pgs-menu" role="listbox" aria-label="Результаты поиска">
          {isFetching && items.length === 0 && <div className="pgs-note">Ищу…</div>}
          {error && items.length === 0 && <div className="pgs-note pgs-err">{(error as Error).message}</div>}
          {!isFetching && items.length === 0 && !error && <div className="pgs-note">Такого ника нет в OpenDota.</div>}
          {items.map((p, i) => (
            <button key={p.account_id} type="button" role="option" aria-selected={i === idx}
                    className={`pgs-item${i === idx ? " sel" : ""}`}
                    onMouseEnter={() => setIdx(i)} onMouseDown={(e) => { e.preventDefault(); go(p.account_id); }}>
              {p.avatar
                ? <img src={p.avatar} alt="" width={30} height={30} loading="lazy" />
                : <span className="pgs-nopic"><User size={15} /></span>}
              <span className="pgs-txt">
                <b>{p.name}</b>
                <small>{p.rank_name ?? "звание скрыто"}{p.pro && " · про"}</small>
              </span>
              <RankBadge rankTier={p.rank_tier} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

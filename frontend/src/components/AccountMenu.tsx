import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompare, LogIn, LogOut, UserRound } from "lucide-react";
import { getMe, logout } from "../api";

/** Иконка профиля в правом верхнем углу: вход через Steam или меню с аватаркой. */
export default function AccountMenu() {
  const qc = useQueryClient();
  const loc = useLocation();
  const { data } = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 300_000 });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!data) return <span className="acct-ph" aria-hidden="true" />;
  if (!data.logged_in) {
    return (
      <a className="steam-btn" href={`/api/v1/auth/steam/login?next=${encodeURIComponent(loc.pathname + loc.search)}`}>
        <LogIn size={16} />Войти через Steam
      </a>
    );
  }
  const name = data.name ?? `Игрок ${data.account_id}`;
  const exit = async () => { await logout(); qc.setQueryData(["me"], { logged_in: false }); setOpen(false); };
  return (
    <div className="acct" ref={ref}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Профиль: ${name}`} onClick={() => setOpen(!open)}>
        {data.avatar ? <img src={data.avatar} alt="" width={36} height={36} /> : <UserRound size={18} />}
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-head">
            {data.avatar && <img src={data.avatar} alt="" width={44} height={44} />}
            <div><b>{name}</b><small className="muted">Account ID {data.account_id}</small></div>
          </div>
          <Link role="menuitem" to={`/player/${data.account_id}`} onClick={() => setOpen(false)}><UserRound size={16} />Мой профиль</Link>
          <Link role="menuitem" to={`/compare?a=${data.account_id}`} onClick={() => setOpen(false)}><GitCompare size={16} />Сравнить с другим игроком</Link>
          <button type="button" role="menuitem" className="acct-out" onClick={exit}><LogOut size={16} />Выйти</button>
        </div>)}
    </div>
  );
}

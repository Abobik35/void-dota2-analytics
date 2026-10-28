import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

type Mode = "match" | "player";
const STEAM64_BASE = 76561197960265728n;

export default function Home() {
  const [mode, setMode] = useState<Mode>("match");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (mode === "match") {
      if (!/^\d{6,12}$/.test(v)) return setError("Match ID — число из 9–10 цифр, например 7890123456.");
      return nav(`/match/${v}`);
    }
    if (/^\d{16,17}$/.test(v)) {  // SteamID64 → account ID
      const id = BigInt(v) - STEAM64_BASE;
      if (id > 0n && id < 4294967296n) return nav(`/player/${id}`);
    } else if (/^\d{3,10}$/.test(v)) return nav(`/player/${v}`);
    setError("Account ID — число до 10 цифр (как в адресе профиля на OpenDota) или SteamID64 из 17 цифр.");
  }

  const pick = (m: Mode) => { setMode(m); setError(""); setValue(""); };
  return (
    <>
      <div className="void-bg" aria-hidden="true" />
      <section className="home">
        <div className="home-card">
          <span className="eyebrow"><i className="mark" />VOID · Dota 2 Analytics</span>
          <h1>Разберите матч до последней минуты</h1>
          <p className="muted">Вставьте Match ID — VOID покажет игроков, экономику и вклад каждого. Или откройте профиль игрока и его историю матчей.</p>
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={mode === "match"} onClick={() => pick("match")}>Матч</button>
            <button role="tab" aria-selected={mode === "player"} onClick={() => pick("player")}>Игрок</button>
          </div>
          <form onSubmit={submit} className="search">
            <Search size={18} />
            <input value={value} onChange={(e) => { setValue(e.target.value); setError(""); }}
                   placeholder={mode === "match" ? "Match ID" : "Account ID или SteamID64"} inputMode="numeric"
                   aria-label={mode === "match" ? "Match ID" : "Account ID игрока"} />
            <button type="submit">{mode === "match" ? "Открыть матч" : "Открыть игрока"}</button>
          </form>
          {error && <p className="err">{error}</p>}
        </div>
      </section>
    </>
  );
}

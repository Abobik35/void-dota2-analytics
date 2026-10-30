import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { getParseStatus, requestParse } from "../api";

const EVERY_MS = 10_000;
const MAX_TRIES = 18; // ≈ 3 минуты
type State = "idle" | "requesting" | "polling" | "failed" | "error";

export default function ParseBanner({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const [state, setState] = useState<State>("idle");
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function poll(n: number) {
    try {
      if ((await getParseStatus(matchId)).parsed) { await qc.invalidateQueries(); return; }
    } catch (e) { setState("error"); setMsg((e as Error).message); return; }
    if (n >= MAX_TRIES) { setState("failed"); return; }
    setTries(n);
    timer.current = window.setTimeout(() => poll(n + 1), EVERY_MS);
  }

  async function start() {
    setState("requesting"); setMsg("");
    try {
      const r = await requestParse(matchId);
      if (r.status === "already_parsed") { await qc.invalidateQueries(); return; }
      setState("polling"); setTries(0);
      timer.current = window.setTimeout(() => poll(1), EVERY_MS);
    } catch (e) { setState("error"); setMsg((e as Error).message); }
  }

  const waiting = state === "polling" || state === "requesting";
  const progress = state === "polling" ? Math.min(100, Math.round(((tries + 1) / MAX_TRIES) * 100)) : null;
  return (
    <div className={`note parse${waiting ? " busy" : ""}`} aria-live="polite">
      <div className="parse-body">
        <p className="parse-title">
          {waiting && <LoaderCircle size={16} className="parse-spin" aria-hidden="true" />}
          {!waiting && state !== "idle" && <TriangleAlert size={16} className="parse-warn" aria-hidden="true" />}
          <b>Матч не обработан.</b> Без реплея нет графика по минутам, покупок и части метрик.
        </p>
        {state === "idle" && <p className="parse-sub">Можно попросить OpenDota распарсить его прямо сейчас — обычно 30–60 секунд.</p>}
        {state === "requesting" && <p className="parse-sub">Отправляю запрос…</p>}
        {state === "polling" && (
          <p className="parse-sub">Жду результат: прошло ≈{tries * 10 + 10} с из ~3 мин · проверка {tries + 1}/{MAX_TRIES}. Страницу можно не закрывать.</p>
        )}
        {state === "failed" && <p className="parse-sub">За 3 минуты не обработался. Если матчу больше недели — Valve уже удалил реплей, сценарий не поможет.</p>}
        {state === "error" && <p className="parse-sub err">{msg}</p>}
        {progress !== null && (
          <div className="parse-track" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
        )}
      </div>
      {state === "idle" && <button className="parse-btn" onClick={start}>Запросить обработку</button>}
      {(state === "failed" || state === "error") && <button className="parse-btn" onClick={start}>Попробовать ещё раз</button>}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

  const retry = <button onClick={start}>Повторить запрос</button>;
  return (
    <div className="note parse" aria-live="polite">
      <p>OpenDota ещё не обработал реплей этого матча: графика по минутам и части показателей нет.</p>
      {state === "idle" && <button onClick={start}>Запросить обработку</button>}
      {state === "requesting" && <span>Отправляю запрос…</span>}
      {state === "polling" && <span>Запрос принят. Жду результат, проверка {tries + 1} из {MAX_TRIES}. Страницу можно не закрывать.</span>}
      {state === "failed" && <><span>За 3 минуты матч не обработан. Если ему больше недели, реплей, скорее всего, уже удалён у Valve.</span>{retry}</>}
      {state === "error" && <><span className="err">{msg}</span>{retry}</>}
    </div>
  );
}

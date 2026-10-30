import { CSSProperties, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CATEGORY_LABELS, CURRENT_VERSION, RELEASES, groupChanges } from "../changelog/releases";
import "../styles/patchnotes.css";

const SEEN_KEY = "void.patchnotes.lastSeen";
const readSeen = (): string | null => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, CURRENT_VERSION); } catch { /* приватный режим: просто не запоминаем */ } };
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function Dialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [shown, setShown] = useState(open);      // окно есть в DOM
  const [closing, setClosing] = useState(false); // идёт анимация закрытия
  const [sel, setSel] = useState(RELEASES[0].version);
  const dlg = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) { opener.current = document.activeElement as HTMLElement | null; setShown(true); setClosing(false); setSel(RELEASES[0].version); return; }
    if (!shown) return;
    setClosing(true);
    const id = window.setTimeout(() => { setShown(false); setClosing(false); opener.current?.focus(); }, 200);
    return () => window.clearTimeout(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open && shown) closeBtn.current?.focus(); }, [open, shown]);

  // запрет прокрутки страницы под окном без «прыжка» из-за пропавшей полосы прокрутки
  useEffect(() => {
    if (!shown) return;
    const { overflow, paddingRight } = document.body.style;
    const bar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (bar > 0) document.body.style.paddingRight = `${bar}px`;
    return () => { document.body.style.overflow = overflow; document.body.style.paddingRight = paddingRight; };
  }, [shown]);

  useEffect(() => { body.current?.scrollTo({ top: 0 }); }, [sel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !dlg.current) return;
      const items = Array.from(dlg.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!dlg.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onListKey = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = RELEASES.findIndex((r) => r.version === sel);
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? i - 1
      : e.key === "Home" ? 0 : e.key === "End" ? RELEASES.length - 1 : null;
    if (next == null) return;
    e.preventDefault();
    const idx = Math.max(0, Math.min(RELEASES.length - 1, next));
    setSel(RELEASES[idx].version);
    (e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[idx])?.focus();
  }, [sel]);

  if (!shown) return null;
  const release = RELEASES.find((r) => r.version === sel) ?? RELEASES[0];
  const latest = release.version === CURRENT_VERSION;

  return createPortal(
    <div className={`pn-overlay${closing ? " closing" : ""}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pn-dialog" ref={dlg} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="pn-head">
          <span className="pn-mark" aria-hidden="true" />
          <h2 id={titleId}>PATCH NOTES</h2>
          <span className="pn-ver">v{CURRENT_VERSION}</span>
          <button type="button" className="pn-close" ref={closeBtn} onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </header>

        <div className="pn-main">
          <div className="pn-list" role="tablist" aria-orientation="vertical" aria-label="Версии VOID" onKeyDown={onListKey}>
            {RELEASES.map((r, i) => (
              <button key={r.version} type="button" role="tab" id={`pn-tab-${r.version}`} aria-selected={r.version === sel} aria-controls="pn-panel"
                      tabIndex={r.version === sel ? 0 : -1} className="pn-item" style={{ "--i": i } as CSSProperties} onClick={() => setSel(r.version)}>
                <b>v{r.version}</b><span>{r.title}</span>
              </button>))}
          </div>

          <div className="pn-content" ref={body} role="tabpanel" id="pn-panel" aria-labelledby={`pn-tab-${release.version}`} tabIndex={0}>
            <div className="pn-rel" key={release.version}>
              <div className="pn-rel-head">
              <span className="pn-rel-ver">v{release.version}</span>
              {latest && <span className="pn-latest">последняя</span>}
              {release.date && <span className="pn-date">{release.date}</span>}
              </div>
              <h3>{release.title}</h3>
              <p className="pn-summary">{release.summary}</p>
              {groupChanges(release).map(([cat, items]) => (
                <section key={cat} className="pn-group">
                  <h4><span className={`pn-tag ${cat.toLowerCase()}`}>{cat}</span><span>{CATEGORY_LABELS[cat]}</span></h4>
                  <ul>{items.map((c) => <li key={c.text}>{c.text}</li>)}</ul>
                </section>))}
            </div>
          </div>
        </div>

        <footer className="pn-foot">
          <span>Текущая версия VOID — v{CURRENT_VERSION}</span>
          <span className="pn-seen">Просмотрено · Esc — закрыть</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Кнопка с номером версии в шапке + окно Patch Notes. Показывается автоматически один раз для каждой новой версии. */
export default function PatchNotes() {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(() => readSeen() !== CURRENT_VERSION);

  useEffect(() => {
    if (readSeen() === CURRENT_VERSION) return;
    const id = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => { if (open) { markSeen(); setUnseen(false); } }, [open]);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="ver-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} title="История обновлений">
        v{CURRENT_VERSION}{unseen && <i className="ver-dot" aria-label="Есть непросмотренные обновления" />}
      </button>
      <Dialog open={open} onClose={close} />
    </>
  );
}

import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

/** Плавное раскрытие по высоте (grid 0fr → 1fr), содержимое скрыто от фокуса и скринридеров, пока закрыто. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`collapse${open ? " open" : ""}`} aria-hidden={!open}>
      <div>{children}</div>
    </div>
  );
}

export function Disclosure({ title, children }: { title: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="disc">
      <button type="button" className="disc-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDown className="chev" size={16} />{title}
      </button>
      <Collapse open={open}>{children}</Collapse>
    </div>
  );
}

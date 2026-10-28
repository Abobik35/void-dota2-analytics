import { useLayoutEffect, useRef, useState } from "react";

/** Переключатель режимов со скользящей «подложкой». */
export default function Segmented<T extends string>({ options, value, onChange, label }: {
  options: [T, string][]; value: T; onChange: (v: T) => void; label: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[value];
      if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value, options]);

  return (
    <div className="seg2" role="tablist" aria-label={label}>
      {box && <i className="seg2-thumb" style={{ transform: `translateX(${box.left}px)`, width: box.width }} />}
      {options.map(([id, text]) => (
        <button key={id} ref={(el) => { refs.current[id] = el; }} role="tab" aria-selected={value === id} onClick={() => onChange(id)}>{text}</button>))}
    </div>
  );
}

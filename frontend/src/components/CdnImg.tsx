import { ImgHTMLAttributes, useEffect, useMemo, useState } from "react";

/** Локальные папки для картинок (frontend/public/assets). Проверяются по порядку до обращения к CDN. */
const MAP: Array<[marker: string, dirs: string[]]> = [
  ["/dota_react/heroes/", ["assets/heroes"]],
  ["/dota_react/items/", ["assets/items", "assets/neutrals"]],
  ["/dota_react/abilities/", ["assets/abilities"]],
];

/** Ожидаемые локальные пути для картинки из CDN Steam; [] — если локальной папки для неё нет. */
export function localCandidates(src: string | null | undefined): string[] {
  if (!src) return [];
  const name = src.split(/[?#]/)[0].split("/").pop();
  if (!name || !/\.(png|jpe?g|webp|svg)$/i.test(name)) return [];
  const out: string[] = [];
  for (const [marker, dirs] of MAP) if (src.includes(marker)) {
    for (const dir of dirs) {
      out.push(`/${dir}/${name}`);
      // запасной вариант с полным именем Valve: npc_dota_hero_antimage.png
      if (marker.endsWith("/heroes/")) out.push(`/${dir}/npc_dota_hero_${name}`);
    }
  }
  return out;
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  onFail?: ImgHTMLAttributes<HTMLImageElement>["onError"]; // что сделать, если файла нет и в assets, и на CDN
};

/** img, который сначала ищет файл в assets/ и лишь при неудаче грузит оригинал с CDN Steam. */
export default function CdnImg({ src, onFail, ...rest }: Props) {
  const files = useMemo(() => localCandidates(src), [src]);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [src]);
  const url = i < files.length ? files[i] : (src ?? undefined);
  return (
    <img {...rest} src={url}
      onError={(e) => { if (i < files.length) setI(i + 1); else onFail?.(e); }} />
  );
}

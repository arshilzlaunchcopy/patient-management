"use client";

import { useEffect, useState } from "react";

function fmt(seconds: number) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Dashboard countdown to a timestamp. Shows "expired" at zero. */
export function Countdown({ until }: { until: string }) {
  const target = new Date(until).getTime();
  const [left, setLeft] = useState(() => Math.round((target - Date.now()) / 1000));

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.round((target - Date.now()) / 1000)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <span className={`tabular-nums ${left <= 0 ? "text-red-700" : left < 300 ? "text-amber-700" : ""}`}>
      {left <= 0 ? "expired" : fmt(left)}
    </span>
  );
}

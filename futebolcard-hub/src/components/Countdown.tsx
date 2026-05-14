import { useState, useEffect } from "react";

// Target: quarta-feira 13/05/2026, 10:00 BRT (UTC-3)
const TARGET = new Date("2026-05-13T13:00:00Z"); // 10:00 BRT = 13:00 UTC

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(): TimeLeft {
  const diff = Math.max(0, TARGET.getTime() - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function Countdown() {
  const [time, setTime] = useState(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const finished =
    time.days === 0 && time.hours === 0 && time.minutes === 0 && time.seconds === 0;

  if (finished) return null;

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      <TimeBox value={time.days} label="Dias" />
      <Separator />
      <TimeBox value={time.hours} label="Horas" />
      <Separator />
      <TimeBox value={time.minutes} label="Min" />
      <Separator />
      <TimeBox value={time.seconds} label="Seg" />
    </div>
  );
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-extrabold tabular-nums text-white shadow-lg sm:h-20 sm:w-20 sm:text-4xl"
        style={{ fontFamily: '"Montserrat", sans-serif' }}
      >
        {String(value).padStart(2, "0")}
      </div>
      <span
        className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 sm:text-xs"
        style={{ fontFamily: '"Montserrat", sans-serif' }}
      >
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <span className="mb-5 text-2xl font-bold text-primary sm:text-3xl">:</span>
  );
}

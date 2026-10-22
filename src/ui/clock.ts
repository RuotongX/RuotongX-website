// Auckland local time + a guess at what I'm doing right now.
const fmt = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
});

function status(hour: number, weekend: boolean) {
  if (hour < 6) return 'asleep, probably';
  if (hour < 8) return 'making coffee';
  if (weekend) return hour < 18 ? 'outside, or breaking the home lab' : 'on a side project';
  if (hour < 9) return 'commuting';
  if (hour < 12) return 'at work, shipping';
  if (hour < 13) return 'lunch';
  if (hour < 18) return 'at work, debugging';
  if (hour < 20) return 'dinner';
  return 'on a side project';
}

export function startClock(el: HTMLElement) {
  const time = el.querySelector('.clock-time')!;
  const stat = el.querySelector('.clock-status')!;
  const tick = () => {
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
    const hour = Number(parts.hour) % 24;
    const weekend = parts.weekday === 'Sat' || parts.weekday === 'Sun';
    time.textContent = `${String(hour).padStart(2, '0')}:${parts.minute}`;
    stat.textContent = status(hour, weekend);
  };
  tick();
  setInterval(tick, 15_000);
}

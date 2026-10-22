// The "Lights" switch: day (paper) <-> night (graphite). Remembers the choice.
export function initLamp(btn: HTMLButtonElement, onChange: (night: boolean) => void) {
  const root = document.documentElement;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const label = btn.querySelector('.lamp-label')!;
  const state = { night: root.dataset.theme === 'night' };

  const apply = () => {
    root.dataset.theme = state.night ? 'night' : 'day';
    btn.setAttribute('aria-pressed', String(state.night));
    label.textContent = state.night ? 'Lights on' : 'Lights off';
    meta?.setAttribute('content', state.night ? '#0e0e0c' : '#eeeae2');
    onChange(state.night);
  };
  btn.addEventListener('click', () => {
    state.night = !state.night;
    localStorage.setItem('rx-theme', state.night ? 'night' : 'day');
    apply();
  });
  apply();
  return state;
}

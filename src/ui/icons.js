// One icon family: 20px grid, 1.75 stroke, square caps. Transport uses the
// Bauhaus primitives themselves: triangle plays, square stops, circle records.
const svg = (body, filled = false) =>
  `<svg class="icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" ${
    filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"'
  }>${body}</svg>`;

export const icons = {
  play: svg('<path d="M5 3.5 17 10 5 16.5z"/>', true),
  stop: svg('<rect x="4.5" y="4.5" width="11" height="11"/>', true),
  record: svg('<circle cx="10" cy="10" r="6"/>', true),
  tap: svg('<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="2" fill="currentColor" stroke="none"/>'),
  upload: svg('<path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 12.5v4h13v-4"/>'),
  download: svg('<path d="M10 3.5V13M6 9l4 4 4-4M3.5 12.5v4h13v-4"/>'),
  minus: svg('<path d="M5 10h10"/>'),
  plus: svg('<path d="M5 10h10M10 5v10"/>'),
  close: svg('<path d="M5 5l10 10M15 5 5 15"/>'),
  copy: svg('<rect x="6.5" y="6.5" width="10" height="10"/><path d="M3.5 13.5v-10h10"/>'),
  energy: svg('<path d="M11 2.5 4.5 11H10l-1 6.5L15.5 9H10z"/>'),
  retake: svg('<path d="M4 10a6 6 0 1 0 1.8-4.3M4 3.5v3.5h3.5"/>'),
};

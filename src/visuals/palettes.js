export function hexToRgba(hex, alpha = 1) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getLuminance(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  const num = parseInt(c, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const PRESET_PALETTES = {
  lofi: ['#1b2a49', '#e07a5f', '#f2cc8f', '#81b29a', '#3d5a80'],
  synthwave: ['#0b091a', '#ff007f', '#00f0ff', '#ffe600', '#7928ca'],
  trap: ['#111116', '#e63946', '#f1faee', '#a8dadc', '#457b9d'],
  ambient: ['#0d1b2a', '#415a77', '#778da9', '#e0e1dd', '#90e0ef'],
};

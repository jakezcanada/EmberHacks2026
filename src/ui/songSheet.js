import { LANES, laneActivity } from '../visuals/lanes.js';
import { glyphSvgPath } from '../visuals/shapes.js';
import { icons } from './icons.js';
import { escapeHtml } from './escape.js';
import catalog from '../music/sound-catalog.json';

const WROTE = { drums: 'drums, bass and chords', melody: 'a melody, bass and chords', both: 'drums, melody, bass and chords', prompt: 'drums, melody, bass and chords', none: 'nothing new' };
const PART_NAMES = { drums: 'drums', melody: 'melody', both: 'melody and drums', prompt: 'a text prompt', none: 'nothing' };

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '–');

export function glyphSvg(shape, color, { size = 22, silent = false } = {}) {
  return `<svg class="glyph" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <path d="${glyphSvgPath(shape, size)}" fill="${silent ? 'none' : color}" stroke="#141414" stroke-width="1.25" ${silent ? 'stroke-dasharray="2.5 2.5" opacity="0.5"' : ''}/>
  </svg>`;
}

/**
 * The Song tab: what Gemini made, the director note, measurements, and the
 * instrument legend (shape + color + name) that keys the painting and score.
 */
export class SongSheet {
  constructor(container, { onRefine }) {
    this.container = container;
    this.onRefine = onRefine;
    this.rows = {};
    this.timers = {};
  }

  render(song, { colors, shapes, isExample = false, isFallback = false } = {}) {
    if (!song) return;
    const a = song.analysis || {};
    const counts = laneActivity(song);
    const bars = song.drums?.bars || 2;
    const title = a.genre_hint ? a.genre_hint.charAt(0).toUpperCase() + a.genre_hint.slice(1) : 'Untitled loop';

    const origin = isExample
      ? 'Example preset, written by hand for offline demos.'
      : isFallback
      ? 'Gemini was unavailable, so this matching preset is playing. Try Generate again in a moment.'
      : `You gave ${PART_NAMES[a.provided] || 'a prompt'}. Gemini wrote ${WROTE[a.generated] || 'the rest'}.`;

    const measures = [
      ['Tempo', `${a.tempo ?? '–'} BPM`],
      ['Key', a.key || '–'],
      ['Loop', `${bars} ${bars === 1 ? 'bar' : 'bars'} of ${a.time_signature || '4/4'}`],
      ['Swing', `${Math.round((song.groove?.swing || 0) * 100)}%`],
      ['Texture', capitalize(song.visual?.texture)],
      ['Motion', capitalize(song.visual?.motion)],
    ];

    this.container.innerHTML = `
      <div class="song">
        <h2 class="song-title">${escapeHtml(title)}</h2>
        <p class="song-origin">${escapeHtml(origin)}</p>
        ${song.director_note ? `<p class="director-note">${escapeHtml(song.director_note)}</p>` : ''}
        <div class="refine">
          <button type="button" class="btn" data-refine="same vibe, more energy">${icons.energy}<span>More energy</span></button>
          <button type="button" class="btn" data-refine="create another take with different variations and fills">${icons.retake}<span>Another take</span></button>
        </div>
        <p class="hint refine-hint">Or drag across the painting: fast for more energy, slow for sparser, low for heavier bass, high for a brighter melody.</p>

        <dl class="measures">
          ${measures.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}
        </dl>
        ${a.mood?.length ? `<p class="mood">${a.mood.map(escapeHtml).join(' · ')}</p>` : ''}

        ${song.sound ? `<h3 class="sheet-heading">The band</h3>
        <dl class="measures band">
          ${[
            ['Drums', catalog.drum_kit[song.sound.drum_kit]?.label],
            ['Melody', catalog.lead[song.sound.lead]?.label],
            ['Bass', catalog.bass[song.sound.bass]?.label],
            ['Chords', catalog.pad[song.sound.pad]?.label],
          ].map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v || '–')}</dd></div>`).join('')}
        </dl>` : ''}

        <h3 class="sheet-heading">Who plays where</h3>
        <ul class="legend">
          ${LANES.map((lane) => {
            const n = counts[lane.id] || 0;
            const unit = lane.id === 'chords' ? (n === 1 ? 'chord' : 'chords') : lane.pitched ? (n === 1 ? 'note' : 'notes') : n === 1 ? 'hit' : 'hits';
            return `<li class="legend-row${n ? '' : ' is-silent'}" data-lane="${lane.id}">
              ${glyphSvg(shapes[lane.id], colors[lane.id], { silent: !n })}
              <span class="legend-name">${lane.label}</span>
              <span class="legend-shape">${shapes[lane.id]}</span>
              <span class="legend-count">${n ? `${n} ${unit}` : 'rests'}</span>
            </li>`;
          }).join('')}
        </ul>

      </div>
    `;

    this.rows = {};
    this.container.querySelectorAll('.legend-row').forEach((row) => (this.rows[row.dataset.lane] = row));
    this.container.querySelectorAll('[data-refine]').forEach((b) => {
      b.addEventListener('click', () => this.onRefine(b.dataset.refine));
    });
  }

  /** Fill the legend glyph while its instrument is sounding. */
  flash(instrument) {
    const row = this.rows[instrument];
    if (!row) return;
    row.classList.add('is-sounding');
    clearTimeout(this.timers[instrument]);
    this.timers[instrument] = setTimeout(() => row.classList.remove('is-sounding'), 140);
  }
}

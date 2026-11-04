import {THEMES} from './themes.js';

// Deterministisk hash, slik at valgene er like ved hver bygging.
function hashText(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededOrder(items, seed) {
  const result = [...items];
  let state = seed || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Fire alternativer: svaret og tre andre verk, helst fra samme epoke.
export function buildThemeChoices(theme, themes = THEMES) {
  const others = themes
    .filter(other => other.id !== theme.id)
    .sort((a, b) => Number(b.era === theme.era) - Number(a.era === theme.era) || a.id.localeCompare(b.id))
    .slice(0, 3);
  return seededOrder([theme.title, ...others.map(other => other.title)], hashText(theme.id));
}

export function buildThemeTargets(themes = THEMES) {
  return themes.map(theme => ({
    id: `theme:${theme.id}`,
    mode: 'theme',
    kind: 'recognition',
    collectionIds: ['kunst-musikk'],
    prompt: 'Hvilket verk begynner slik?',
    answer: theme.title,
    choices: buildThemeChoices(theme, themes),
    explanation: `${theme.composer}: ${theme.title} (${theme.approximate ? 'ca. ' : ''}${theme.year}), ${theme.era.toLowerCase()}, ${theme.key}.`,
    sources: theme.sources.map(source => ({...source})),
    sourceIds: [],
    familiarity: theme.familiarity,
    significance: 3,
    themeId: theme.id,
    composer: theme.composer,
    year: theme.year,
    approximate: theme.approximate,
    era: theme.era,
    melody: {tempo: theme.tempo, notes: theme.notes.map(note => [...note])}
  }));
}

export function gradeTheme(target, draft = {}) {
  return {correct: draft.choice === target.answer};
}

export function themeReady(target, draft = {}) {
  return Boolean(draft.choice) && target.choices.includes(draft.choice);
}

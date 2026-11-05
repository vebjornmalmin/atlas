// Norwegian typography for text read on a narrow screen. A number's digit groups (12 000) and a year
// with its era (4000 f.Kr.) are joined with a no-break space, so a line never ends in the middle of
// them. Grading is unaffected: answers are compared after Unicode normalisation, which turns the
// no-break space back into an ordinary one.
const NBSP = ' ';

export function keepTogether(text) {
  return String(text)
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`)
    .replace(/(\d) (?=[fe]\. ?Kr\.)/g, `$1${NBSP}`);
}

/** The same value with every string in it passed through keepTogether. */
export function keepTextTogether(value) {
  if (typeof value === 'string') return keepTogether(value);
  if (Array.isArray(value)) return value.map(keepTextTogether);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, keepTextTogether(item)]));
  return value;
}

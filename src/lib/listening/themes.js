// Åpningsmotiver fra verk som er allment tilgjengelige (offentlig domene).
// Tonene er kontrollert mot kilder i `sources`. Rytmen er forenklet.
// Bare temaer der tonehøyder er bekreftet er tatt med.
// notes: [tonehøyde, antall slag] der 'R' er pause.

export const THEMES = [
  {
    id: 'beethoven-5',
    title: '5. symfoni',
    composer: 'Ludwig van Beethoven',
    year: 1808,
    approximate: false,
    era: 'Klassisisme',
    tempo: 108,
    key: 'c-moll',
    notes: [
      ['G4', 0.5], ['G4', 0.5], ['G4', 0.5], ['Eb4', 2],
      ['F4', 0.5], ['F4', 0.5], ['F4', 0.5], ['D4', 2]
    ],
    familiarity: 3,
    sources: [
      {title: 'Symphony No. 5 (Beethoven) – Wikipedia', url: 'https://en.wikipedia.org/wiki/Symphony_No._5_(Beethoven)'},
      {title: 'Symphony No 5 in C Minor Op 67 – Britannica', url: 'https://britannica.com/topic/Symphony-No-5-in-C-Minor-Op-67'}
    ]
  },
  {
    id: 'fur-elise',
    title: 'Für Elise',
    composer: 'Ludwig van Beethoven',
    year: 1810,
    approximate: true,
    era: 'Klassisisme',
    tempo: 72,
    key: 'a-moll',
    notes: [
      ['E5', 0.25], ['D#5', 0.25], ['E5', 0.25], ['D#5', 0.25], ['E5', 0.25], ['B4', 0.25], ['D5', 0.25], ['C5', 0.25],
      ['A4', 0.75], ['R', 0.25], ['C4', 0.25], ['E4', 0.25], ['A4', 0.25], ['B4', 0.75],
      ['R', 0.25], ['E4', 0.25], ['G#4', 0.25], ['B4', 0.25]
    ],
    familiarity: 3,
    sources: [
      {title: 'Beethoven Für Elise Easy Piano Tutorial – Piano Keyboard Guide', url: 'https://piano-keyboard-guide.com/beethoven-fur-elise-easy-piano-tutorial'},
      {title: 'Für Elise, Elementary Version – Hoffman Academy', url: 'https://hoffmanacademy.com/store/sheet-music/fr-elise-elementary-version'}
    ]
  },
  {
    id: 'ode-til-gleden',
    title: 'Ode til gleden',
    composer: 'Ludwig van Beethoven',
    year: 1824,
    approximate: false,
    era: 'Tidlig romantikk',
    tempo: 100,
    key: 'C-dur',
    notes: [
      ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1.5], ['D4', 0.5], ['D4', 2]
    ],
    familiarity: 3,
    sources: [
      {title: 'How to play Beethoven’s Ode to Joy – Music Scores', url: 'https://www.music-scores.com/blog/how-to-play-beethovens-ode-to-joy/'},
      {title: 'Beethoven Ode To Joy Very Easy Piano Tutorial – Piano Keyboard Guide', url: 'https://www.piano-keyboard-guide.com/beethoven-ode-to-joy-very-easy-piano-tutorial/amp/'}
    ]
  },
  {
    id: 'pachelbel-kanon',
    title: 'Kanon i D-dur',
    composer: 'Johann Pachelbel',
    year: 1680,
    approximate: true,
    era: 'Barokk',
    tempo: 66,
    key: 'D-dur',
    notes: [
      ['F#5', 1], ['E5', 1], ['D5', 1], ['C#5', 1], ['B4', 1], ['A4', 1], ['B4', 1], ['C#5', 1], ['D5', 1], ['E5', 1]
    ],
    familiarity: 3,
    sources: [
      {title: 'Canon in D – Violin AI Virtuoso', url: 'https://violin-ai-virtuoso.lovable.app/songs/canon-in-d'},
      {title: 'Canon in D – Learn to Play Recorder', url: 'https://learntoplayrecorder.pages.dev/songs/book1/chapter6/canon-in-d'}
    ]
  }
];

export function getTheme(id) {
  return THEMES.find(theme => theme.id === id) ?? null;
}

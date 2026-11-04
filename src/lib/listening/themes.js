// Åpningsmotiver fra verk som er allment tilgjengelige (offentlig domene).
// Kildene i `sources` beskriver verket. Tonene er den kjente åpningen, kontrollert note for note;
// rytmen er forenklet og noen temaer er flyttet til et behagelig leie.
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
    id: 'grieg-morgenstemning',
    title: 'Morgenstemning',
    composer: 'Edvard Grieg',
    year: 1875,
    approximate: true,
    era: 'Nasjonalromantikk',
    tempo: 120,
    key: 'E-dur',
    notes: [
      ['G#5', 1], ['F#5', 0.5], ['E5', 1], ['D#5', 0.5], ['E5', 1], ['F#5', 0.5],
      ['G#5', 1], ['F#5', 0.5], ['E5', 1], ['D#5', 0.5], ['E5', 1], ['F#5', 0.5]
    ],
    familiarity: 1,
    sources: [
      {title: 'Peer Gynt (musikk) – Store norske leksikon', url: 'https://snl.no/Peer_Gynt_-_musikk'},
      {title: 'Edvard Grieg – Store norske leksikon', url: 'https://snl.no/Edvard_Grieg'}
    ]
  },
  {
    id: 'grieg-dovregubben',
    title: 'I Dovregubbens hall',
    composer: 'Edvard Grieg',
    year: 1875,
    approximate: true,
    era: 'Nasjonalromantikk',
    tempo: 104,
    key: 'h-moll',
    notes: [
      ['B4', 0.5], ['C#5', 0.5], ['D5', 0.5], ['E5', 0.5], ['F#5', 0.5], ['D5', 0.5], ['F#5', 1],
      ['F5', 0.5], ['C#5', 0.5], ['F5', 1], ['E5', 0.5], ['C5', 0.5], ['E5', 1]
    ],
    familiarity: 1,
    sources: [
      {title: 'Peer Gynt (musikk) – Store norske leksikon', url: 'https://snl.no/Peer_Gynt_-_musikk'},
      {title: 'Edvard Grieg – Store norske leksikon', url: 'https://snl.no/Edvard_Grieg'}
    ]
  },
  {
    id: 'vivaldi-varen',
    title: 'Våren (De fire årstider)',
    composer: 'Antonio Vivaldi',
    year: 1725,
    approximate: true,
    era: 'Barokk',
    tempo: 92,
    key: 'E-dur',
    notes: [
      ['E5', 1], ['G#5', 0.5], ['G#5', 0.5], ['G#5', 0.5], ['F#5', 0.25], ['E5', 0.25], ['B5', 1.5],
      ['B5', 0.25], ['A5', 0.25], ['G#5', 0.5], ['G#5', 0.5], ['G#5', 0.5], ['F#5', 0.25], ['E5', 0.25], ['B5', 1.5]
    ],
    familiarity: 2,
    sources: [
      {title: 'Dei fire årstidene – Store norske leksikon', url: 'https://snl.no/Dei_fire_%C3%A5rstidene'},
      {title: 'Barokken (musikk) – Store norske leksikon', url: 'https://snl.no/barokken_-_musikk'}
    ]
  },
  {
    id: 'tsjajkovskij-svanesjoen',
    title: 'Svanesjøen',
    composer: 'Pjotr Tsjajkovskij',
    year: 1876,
    approximate: true,
    era: 'Romantikk',
    tempo: 84,
    key: 'h-moll',
    notes: [
      ['F#5', 3], ['B4', 0.5], ['C#5', 0.5], ['D5', 0.5], ['E5', 0.5], ['F#5', 1.5], ['D5', 0.5],
      ['F#5', 1.5], ['D5', 0.5], ['F#5', 1.5], ['B4', 0.5], ['D5', 0.5], ['B4', 0.5], ['G4', 0.5], ['D5', 0.5], ['B4', 3]
    ],
    familiarity: 2,
    sources: [
      {title: 'Pjotr Tsjajkovskij – Store norske leksikon', url: 'https://snl.no/Pjotr_Tsjajkovskij'},
      {title: 'Romantikken (musikk) – Store norske leksikon', url: 'https://snl.no/romantikken_-_musikk'}
    ]
  }
];

export function getTheme(id) {
  return THEMES.find(theme => theme.id === id) ?? null;
}

const source = (title, url) => ({ title, url });
const washington = source('George Washington – Det hvite hus, arkiv', 'https://obamawhitehouse.archives.gov/1600/presidents/georgewashington');
const declaration = source('Uavhengighetserklæringen – National Archives', 'https://www.archives.gov/milestone-documents/declaration-of-independence');
const emancipation = source('Frigjøringserklæringen – National Archives', 'https://www.archives.gov/milestone-documents/emancipation-proclamation');
const roosevelt = source('Franklin D. Roosevelt – Det hvite hus, arkiv', 'https://obamawhitehouse.archives.gov/1600/presidents/franklindroosevelt');
const kennedy = source('Romprogrammet – Kennedy-biblioteket', 'https://www.jfklibrary.org/learn/about-jfk/jfk-in-history/space-program');
const obama = source('Barack Obama – presidentbiblioteket', 'https://www.obamalibrary.gov/obamas/president-barack-obama');
const dday = source('D-dagen – National Army Museum', 'https://www.nam.ac.uk/explore/d-day');
const un = source('FNs historie – FN', 'https://www.un.org/en/about-us/history-of-the-un');
const apollo = source('Apollo 11 – NASA', 'https://www.nasa.gov/mission/apollo-11/');

// Snapshots belong on a separate learning step, never beside an unanswered question.
const anchors = [
  {
    id: 'washington-first', entityId: 'george-washington', collectionIds: ['us-presidents'], year: 1789,
    prompt: 'Hva er George Washington særlig kjent for?', answer: 'Han var USAs første president.',
    distractors: ['Han ledet USA under andre verdenskrig.', 'Han satte målet om en bemannet månelanding.'],
    snapshot: 'George Washington ble USAs første president i 1789. Han hadde tidligere ledet hæren i kampen for uavhengighet fra Storbritannia.',
    explanation: 'Washington var med på å grunnlegge USA og ble landets første president.', sources: [washington]
  },
  {
    id: 'jefferson-declaration', entityId: 'thomas-jefferson', collectionIds: ['us-presidents', 'history'], year: 1776,
    prompt: 'Hvilket dokument skrev Thomas Jefferson hovedutkastet til?', answer: 'USAs uavhengighetserklæring',
    distractors: ['FN-pakten', 'Magna Carta'],
    snapshot: 'Thomas Jefferson skrev hovedutkastet til USAs uavhengighetserklæring i 1776. Andre i komiteen og Kongressen endret teksten.',
    explanation: 'Erklæringen begrunnet kolonienes brudd med Storbritannia. Jefferson skrev hovedutkastet, men teksten var et felles arbeid.', sources: [declaration]
  },
  {
    id: 'lincoln-civil-war', entityId: 'abraham-lincoln', collectionIds: ['us-presidents'], year: 1861,
    prompt: 'Hvilken krig var Abraham Lincoln president under?', answer: 'Den amerikanske borgerkrigen',
    distractors: ['Første verdenskrig', 'Andre verdenskrig'],
    snapshot: 'Abraham Lincoln var president under den amerikanske borgerkrigen på 1860-tallet. Nordstatene kjempet mot sørstatene som hadde brutt ut av USA.',
    explanation: 'Lincoln ledet Unionen under borgerkrigen. Slaveriet var sentralt i konflikten.', sources: [emancipation]
  },
  {
    id: 'lincoln-emancipation', entityId: 'abraham-lincoln', collectionIds: ['us-presidents'], year: 1863,
    prompt: 'Hva handlet Lincolns frigjøringserklæring om?', answer: 'Frihet for mennesker holdt som slaver i opprørsområdene',
    distractors: ['Uavhengighet fra Storbritannia', 'Opprettelsen av FN'],
    snapshot: 'Lincoln utstedte frigjøringserklæringen under borgerkrigen. Den erklærte slaver i opprørsområdene frie, men avskaffet ikke slaveriet i hele USA.',
    explanation: 'Erklæringen var et viktig steg. Slaveriet i hele USA ble forbudt gjennom det 13. grunnlovstillegget i 1865.', sources: [emancipation]
  },
  {
    id: 'roosevelt-depression', entityId: 'franklin-d-roosevelt', collectionIds: ['us-presidents'], year: 1933,
    prompt: 'Hva skulle Franklin D. Roosevelts «New Deal» hjelpe USA ut av?', answer: 'En dyp økonomisk krise',
    distractors: ['En borgerkrig', 'En krig om uavhengighet'],
    snapshot: 'Franklin D. Roosevelt tok over under den store depresjonen, da millioner var uten arbeid. «New Deal» var tiltak for arbeid, hjelp og økonomiske reformer.',
    explanation: 'Den store depresjonen var en alvorlig økonomisk krise. New Deal samlet tiltak for å hjelpe befolkningen og endre økonomien.', sources: [roosevelt]
  },
  {
    id: 'roosevelt-world-war', entityId: 'franklin-d-roosevelt', collectionIds: ['us-presidents'], year: 1941,
    prompt: 'Hvem var USAs president da landet gikk inn i andre verdenskrig?', answer: 'Franklin D. Roosevelt',
    distractors: ['George Washington', 'Abraham Lincoln'],
    snapshot: 'USA gikk inn i andre verdenskrig etter Japans angrep på Pearl Harbor i 1941. Franklin D. Roosevelt var da president.',
    explanation: 'Roosevelt ledet USA gjennom det meste av landets deltakelse i krigen. Han døde i 1945, før krigen var slutt.', sources: [roosevelt]
  },
  {
    id: 'kennedy-moon', entityId: 'john-f-kennedy', collectionIds: ['us-presidents'], year: 1961,
    prompt: 'Hvilket mål satte John F. Kennedy for det amerikanske romprogrammet?', answer: 'Å lande mennesker på månen og få dem trygt hjem',
    distractors: ['Å bygge en bemannet base på Mars', 'Å sende mennesker til Jupiter'],
    snapshot: 'John F. Kennedy satte som mål å sende mennesker til månen og trygt hjem innen 1960-tallet var over. Apollo 11 nådde månen i 1969, etter hans død.',
    explanation: 'Månelandingen var et sentralt mål i romkappløpet. Kennedy satte målet; Apollo 11 gjennomførte det senere.', sources: [kennedy]
  },
  {
    id: 'obama-first-black', entityId: 'barack-obama', collectionIds: ['us-presidents'], year: 2009,
    prompt: 'Hva var historisk ved Barack Obamas valgseier?', answer: 'Han ble USAs første svarte president.',
    distractors: ['Han ble USAs første president.', 'Han ble den første presidenten på 1900-tallet.'],
    snapshot: 'Barack Obama vant presidentvalget i 2008. Da han tiltrådte i 2009, ble han USAs første svarte president.',
    explanation: 'Obama var den første afroamerikaneren som ble valgt til USAs president.', sources: [obama]
  },
  {
    id: 'declaration-independence', entityId: 'us-declaration-of-independence-adopted', collectionIds: ['history'], year: 1776,
    prompt: 'Hva erklærte de tretten koloniene med uavhengighetserklæringen?', answer: 'At de var uavhengige av Storbritannia',
    distractors: ['At de ville bli en del av Frankrike', 'At de opprettet FN'],
    snapshot: 'I 1776 erklærte tretten britiske kolonier i Nord-Amerika seg uavhengige. Uavhengighetserklæringen forklarte hvorfor de ville bryte med Storbritannia.',
    explanation: 'Erklæringen markerte et politisk brudd med Storbritannia. Den betydde ikke at krigen var over.', sources: [declaration]
  },
  {
    id: 'd-day-france', entityId: 'd-day-landings-in-normandy', collectionIds: ['history'], year: 1944,
    prompt: 'I hvilket land fant landgangen i Normandie sted?', answer: 'Frankrike',
    distractors: ['Norge', 'Italia'],
    snapshot: 'På D-dagen gikk allierte styrker i land i Normandie i Frankrike. Landgangen åpnet en ny front mot Nazi-Tyskland i Vest-Europa.',
    explanation: 'Normandie ligger i Nord-Frankrike. Landgangen i 1944 ble starten på en større offensiv i Vest-Europa.', sources: [dday]
  },
  {
    id: 'un-peace', entityId: 'united-nations-begins', collectionIds: ['history'], year: 1945,
    prompt: 'Hva var et hovedmål da FN ble opprettet?', answer: 'Å bevare fred og forebygge nye kriger',
    distractors: ['Å styre alle land som én stat', 'Å erstatte alle nasjonale språk'],
    snapshot: 'FN ble opprettet i 1945 etter ødeleggelsene under andre verdenskrig. Landene ville samarbeide for å bevare fred og forebygge nye kriger.',
    explanation: 'FN er en organisasjon der medlemsland samarbeider. Fred og internasjonal sikkerhet er sentrale mål.', sources: [un]
  },
  {
    id: 'apollo-moon', entityId: 'apollo-11-moon-landing', collectionIds: ['history'], year: 1969,
    prompt: 'Hva oppnådde Apollo 11?', answer: 'Den første bemannede landingen på månen',
    distractors: ['Den første bemannede landingen på Mars', 'Den første satellitten i bane rundt jorden'],
    snapshot: 'Apollo 11 landet på månen i 1969. Neil Armstrong og Buzz Aldrin gikk på overflaten, mens Michael Collins var i bane rundt månen.',
    explanation: 'Apollo 11 var første gang mennesker landet på månen. Alle de tre astronautene kom tilbake til jorden.', sources: [apollo]
  }
];

export function foundationTargets(data) {
  const entities = new Set((data?.entities || []).map(entity => entity.id));
  const collections = new Set((data?.collections || []).map(collection => collection.id));
  const sourceByUrl = new Map((data?.sources || []).map(item => [item.url, item.id]));
  const curated = anchors.filter(item => entities.has(item.entityId) && item.collectionIds.every(id => collections.has(id)))
    .map(({ distractors, ...item }) => ({
      ...item, id: `foundation:${item.id}`, kind: 'foundation', mode: 'recognition',
      learningStage: 'foundation', difficulty: 1, significance: 5, acceptedAnswers: [],
      sourceIds: item.sources.map(item => sourceByUrl.get(item.url)).filter(Boolean),
      collectionIds: [...item.collectionIds], sources: item.sources.map(item => ({ ...item })),
      options: [item.answer, ...distractors].map(label => ({ label, correct: label === item.answer }))
    }));
  const firstTerms = new Map();
  for (const target of data?.targets || []) {
    if (!target.id.startsWith('president-start-') || !entities.has(target.entityId) || !collections.has('us-presidents')) continue;
    const year = Number(target.answer);
    if (!Number.isInteger(year) || year < 1700 || year >= 2100) continue;
    const previous = firstTerms.get(target.entityId);
    if (!previous || year < previous.year) firstTerms.set(target.entityId, { target, year });
  }
  const entityById = new Map((data?.entities || []).map(entity => [entity.id, entity]));
  const sourceById = new Map((data?.sources || []).map(item => [item.id, item]));
  const periods = [...firstTerms].map(([entityId, { target, year }]) => {
    const name = entityById.get(entityId).label;
    const answer = `${Math.floor(year / 100) * 100}-tallet`;
    const sourceIds = (target.sourceIds || []).filter(id => sourceById.has(id));
    return {
      id: `foundation:period:${entityId}`, entityId, collectionIds: ['us-presidents'],
      prompt: `På hvilket hundreår begynte ${name} som president?`, answer,
      acceptedAnswers: [], kind: 'foundation', mode: 'recognition', learningStage: 'foundation',
      difficulty: 1, significance: 4, year,
      snapshot: `${name} ble president første gang i ${year}. Det plasserer starten på presidentskapet på ${answer}.`,
      explanation: `${name} tiltrådte første gang i ${year}, altså på ${answer}.`,
      sourceIds, sources: sourceIds.map(id => ({ title: sourceById.get(id).title, url: sourceById.get(id).url })),
      options: ['1700-tallet', '1800-tallet', '1900-tallet', '2000-tallet'].map(label => ({ label, correct: label === answer }))
    };
  });
  return [...curated, ...periods];
}

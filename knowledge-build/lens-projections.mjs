// How each historiographical lens reads the shared knowledge graph.
// Weights are editorial choices, not claims about the historians. They decide which
// relations and node types a lens brings forward; the blind spot names what Atlas cannot show yet.
export const LENS_PROJECTIONS = {
  'source-criticism': {
    order: 1, weights: {impact: 30, actuality: 20, locality: 50}, metric: 'source-depth',
    types: {document: 1, 'award-event': .3, event: .8, 'news-event': .6},
    relations: {'concerns-document': 1, drafted: .8, adopted: .8, mentions: .4},
    blindspot: 'Atlas teller kilder og omstridte påstander, men leser ikke selve kildene. Antall kilder sier ikke alene noe om kvalitet.'
  },
  providential: {
    order: 2, weights: {impact: 70, actuality: 0, locality: 30},
    types: {document: .6, threshold: .4, event: .5},
    relations: {precedes: .6, succeeded: .4},
    blindspot: 'Atlas har nesten ikke religionshistorie. Linsen vises mest gjennom tenkerne og ideen om en rettet tid.'
  },
  cyclical: {
    order: 3, weights: {impact: 60, actuality: 20, locality: 20},
    types: {'political-office': .6, person: .2},
    relations: {succeeded: 1, 'held-office': .7, 'formerly-part-of': .8},
    blindspot: 'Atlas har presidentskifter og fylkesreformer, men ikke stigning og fall for riker og dynastier.'
  },
  progress: {
    order: 4, weights: {impact: 70, actuality: 10, locality: 20},
    types: {concept: .7, 'award-event': .5, threshold: .5},
    relations: {'recognized-contribution': 1, 'recognized-for': .9, 'award-category': .2},
    collections: {science: .6, 'nobel-physics': .6, 'nobel-chemistry': .6, 'nobel-medicine': .6},
    blindspot: 'Vitenskapelige priser fremhever gjennombrudd som ble belønnet. Tilbakeslag og kostnader er knapt registrert.'
  },
  'great-individuals': {
    order: 5, weights: {impact: 75, actuality: 10, locality: 15},
    types: {person: 1, 'political-office': .5},
    relations: {'held-office': 1, commanded: 1, drafted: .9, 'author-of': .6, 'created-by': .6, received: .5, 'awarded-prize': .4},
    blindspot: 'Atlas består mest av navngitte personer. Det forsterker denne linsen og gjør massebevegelser usynlige.'
  },
  materialist: {
    order: 6, weights: {impact: 50, actuality: 35, locality: 15},
    types: {organization: .9, concept: .3},
    relations: {'award-time-affiliation': .5, 'located-in-country': .6, 'knowledge-flow': .5},
    collections: {'nobel-economics': 1},
    newsDomains: {economy: 1, society: .6},
    blindspot: 'Atlas mangler data om produksjon, eiendom, lønn og klasse. Institusjoner og økonomipriser er bare et svakt spor.'
  },
  civilizations: {
    order: 7, weights: {impact: 60, actuality: 10, locality: 30},
    types: {region: 1, 'country-area': .3, country: .3},
    relations: {'in-region': 1, 'located-in': .7},
    blindspot: 'Atlas bruker FNs statistiske regioner. De er ikke Spenglers eller Toynbees sivilisasjoner og skal ikke leses slik.'
  },
  annales: {
    order: 8, weights: {impact: 35, actuality: 10, locality: 55},
    types: {region: .8, county: .7, municipality: .4, 'country-area': .5, country: .5},
    relations: {borders: .8, 'in-region': .7, 'located-in': .6, 'part-of': .5},
    blindspot: 'Klima, jordbruk og priser over lange tidsrom finnes ikke i Atlas. Grenser og regioner er bare de faste rammene.'
  },
  'from-below': {
    order: 9, weights: {impact: 15, actuality: 40, locality: 45},
    types: {'news-event': .6, 'fictional-character': .5, municipality: .4},
    relations: {mentions: .6, 'features-character': .5},
    collections: {'nobel-peace': .4},
    newsDomains: {society: 1, health: .8, economy: .5},
    blindspot: 'Vanlige menneskers liv er nesten fraværende i registeret. Linsen viser dermed mest hvor Atlas er blind.'
  },
  microhistory: {
    order: 10, weights: {impact: 10, actuality: 20, locality: 70},
    types: {municipality: 1, county: .5, 'fictional-character': .4, event: .5},
    relations: {'part-of': .7, 'took-place-in': .8},
    blindspot: 'Atlas har kommuner, men ingen rettsprotokoller, brev eller lokale enkeltskjebner.'
  },
  metahistory: {
    order: 11, weights: {impact: 60, actuality: 10, locality: 30},
    types: {'scholarly-work': 1, 'literary-work': .6, concept: .3},
    relations: {'emplotted-as': 1, 'author-of': .6, 'features-character': .4, 'uses-device': .8},
    blindspot: 'Plotformene gjelder historikernes tekster. Atlas analyserer ikke selv fortellingene i nyheter eller verk.'
  },
  'power-discourse': {
    order: 12, weights: {impact: 55, actuality: 30, locality: 15},
    types: {'political-office': 1, award: .8, document: .7, organization: .5},
    relations: {'held-office': .7, adopted: .8, drafted: .7, established: .7, awarded: .6, 'award-category': .4},
    blindspot: 'Linsen ser hvem som utnevner, belønner og definerer. Den kan ikke vise skjulte normer uten kilder om dem.'
  },
  postcolonial: {
    order: 13, weights: {impact: 40, actuality: 30, locality: 30}, metric: 'recognized-abroad',
    types: {region: .4, 'country-area': .6, country: .6},
    relations: {'knowledge-flow': 1, 'birthplace-in-current-country': .4},
    blindspot: 'Atlas har ikke koloniforhold. Kartet viser bare hvor stor andel av landets prisvinnere som ble anerkjent mens de arbeidet i et annet land.'
  },
  gender: {
    order: 14, weights: {impact: 40, actuality: 30, locality: 30}, metric: 'women-recognized',
    types: {person: .2},
    attributes: {gender: {female: 1.6}},
    relations: {received: .3, 'awarded-prize': .3},
    blindspot: 'Kjønn er bare registrert for Nobelprisvinnere. Prisregisteret har langt flere menn enn kvinner, og forskjellen er selve funnet.'
  },
  'world-system': {
    order: 15, weights: {impact: 55, actuality: 25, locality: 20}, metric: 'flow-balance',
    types: {country: .5, 'country-area': .5, organization: .6},
    relations: {'knowledge-flow': 1, 'award-time-affiliation': .6, 'located-in-country': .5},
    blindspot: 'Strømmen av prisvinnere mellom land er et svakt stedfortredende mål for kjerne og periferi. Atlas har ikke handel eller kapitalstrømmer.'
  },
  networks: {
    order: 16, weights: {impact: 45, actuality: 25, locality: 30},
    types: {organization: .6, person: .4, country: .4, 'country-area': .4},
    relations: {'knowledge-flow': 1, influenced: 1, 'award-time-affiliation': .8, 'birthplace-in-current-country': .6, borders: .5},
    blindspot: 'Nettverket viser prisvinneres flyt, påvirkning mellom tenkere og landegrenser. Handelsruter og migrasjon generelt mangler.'
  },
  ecological: {
    order: 17, weights: {impact: 40, actuality: 40, locality: 20},
    types: {region: .5, concept: .3},
    relations: {borders: .4, 'in-region': .3},
    collections: {'nobel-medicine': .4},
    newsDomains: {climate: 1, health: .6},
    blindspot: 'Atlas har ikke klima-, sykdoms- eller artsdata. Nyheter og eksempler bærer linsen inntil slike kilder finnes.'
  },
  'big-history': {
    order: 18, weights: {impact: 90, actuality: 0, locality: 10},
    types: {threshold: 1, concept: .6},
    relations: {precedes: 1, 'recognized-contribution': .5},
    collections: {science: .5, 'nobel-physics': .7, 'nobel-chemistry': .6, 'nobel-medicine': .5},
    blindspot: 'Terskelene spenner over milliarder av år. Tallene er avrundede anslag, og mennesket er bare den siste delen.'
  },
  memory: {
    order: 19, weights: {impact: 45, actuality: 15, locality: 40},
    types: {artwork: 1, 'literary-work': .8, document: .8, event: .8, 'fictional-character': .4},
    relations: {'depicts-place': 1, 'concerns-document': .7, 'took-place-in': .7, 'created-by': .5},
    blindspot: 'Atlas har få minnesteder og monumenter. Kunstverk, bøker og hendelser står i stedet for dem.'
  },
  geopolitics: {
    order: 20, weights: {impact: 45, actuality: 40, locality: 15},
    types: {country: 1, 'country-area': 1, city: .4, region: .5, 'news-event': .5},
    relations: {borders: 1, 'capital-of': .6, 'in-region': .5, mentions: .7},
    newsDomains: {conflict: 1, politics: .8},
    blindspot: 'Grensene gjelder i dag og er forenklet. Linsen vurderer ikke hvilke maktforhold som er rimelige eller rettferdige.'
  }
};

// Learning formats that read the perspective layer. Labels appear in the quiz menu.
export const WORLD_FORMATS = [
  {id: 'flags', label: 'Flagg', note: 'Flagg og land begge veier'},
  {id: 'neighbours', label: 'Naboland', note: 'Hvem grenser til hvem?'},
  {id: 'border-walk', label: 'Naboreise', note: 'Reis over land fra nabo til nabo'},
  {id: 'news-map', label: 'Nyhetskartet', note: 'Plasser dagens nyheter'},
  {id: 'lens-question', label: 'Linsens spørsmål', note: 'Hvilket blikk stiller spørsmålet?'},
  {id: 'thinkers', label: 'Tenkere og ideer', note: 'Koble historikere til begreper'},
  {id: 'emplotment', label: 'Plottlesing', note: 'Hayden Whites metahistorie'},
  {id: 'scale', label: 'Skalastigen', note: 'Ordne i kosmisk tid og avstand'},
  {id: 'knowledge-flow', label: 'Kunnskapsflyt', note: 'Hvor ble talentet anerkjent?'},
  {id: 'perspective-switch', label: 'Perspektivbytte', note: 'Samme sted, ulike linser'}
];

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const endYear = 2025;
const sourcedAt = '2026-10-10T00:00:00Z';
const sourceDir = 'knowledge-build/sources';
const endpoints = {
  laureates: 'https://api.nobelprize.org/2.1/laureates?limit=2000',
  prizes: 'https://api.nobelprize.org/2.1/nobelPrizes?limit=1000',
};
await mkdir(sourceDir, { recursive: true });
if (process.argv.includes('--refresh')) {
  // Snapshot first; a failed or incomplete response never replaces existing data.
  for (const [key, url] of Object.entries(endpoints)) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${key}: HTTP ${response.status}`);
    const text = await response.text();
    const value = JSON.parse(text);
    const rows = value[key === 'prizes' ? 'nobelPrizes' : 'laureates'];
    if (!Array.isArray(rows) || rows.length !== Number(value.meta?.count) || Number(value.meta?.offset) !== 0) throw new Error(`Incomplete ${key} snapshot; pagination required.`);
    const path = `${sourceDir}/nobel-${key === 'prizes' ? 'prizes' : 'laureates'}.json`;
    await writeFile(path + '.tmp', text);
    await rename(path + '.tmp', path);
  }
}
const rawLaureates = await readFile(`${sourceDir}/nobel-laureates.json`, 'utf8');
const rawPrizes = await readFile(`${sourceDir}/nobel-prizes.json`, 'utf8');
const laureateData = JSON.parse(rawLaureates), prizeData = JSON.parse(rawPrizes);
for (const [data, key] of [[laureateData, 'laureates'], [prizeData, 'nobelPrizes']]) {
  if (data[key].length !== Number(data.meta.count) || Number(data.meta.offset) !== 0) throw new Error('Snapshot is not complete.');
}
const foundation = JSON.parse(await readFile('knowledge-build/base-foundation.json', 'utf8'));
const patch = { generatedAt: sourcedAt, sourcedAt, language: 'nb', coverage: {}, collections: [], entities: [], relationships: [], targets: [], sources: [], timelines: [] };
const cleanName = s => String(s || '').replace(/^(Sir|Dame)\s+/i, '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
const slug = s => String(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hash = s => createHash('sha256').update(s).digest('hex');
const getText = o => o?.no || o?.en || o?.se || '';
const foundationIds = new Map(foundation.entities.map(e => [cleanName(e.label), e.id]));
const baseEntities = new Map(foundation.entities.map(e => [e.id, e]));
const entities = new Map(), relationships = new Map(), sources = new Map();
const baseSources = new Set(foundation.sources.map(s => s.id));
const baseRelIds = new Map(foundation.relationships.map(r => [`${r.from}|${r.to}|${r.type}|${r.year || ''}`, r.id]));
const collections = {
  Physics: 'nobel-physics', Chemistry: 'nobel-chemistry', 'Physiology or Medicine': 'nobel-medicine', Peace: 'nobel-peace', Literature: 'nobel-literature', 'Economic Sciences': 'nobel-economics',
};
const categories = {
  Physics: ['fysikk', 'nobel-prize-in-physics', 'physics'], Chemistry: ['kjemi', 'nobel-prize-in-chemistry', 'chemistry'],
  'Physiology or Medicine': ['fysiologi eller medisin', 'nobel-prize-in-physiology-or-medicine', 'medicine'],
  Peace: ['fred', 'nobel-prize-in-peace', 'peace'], Literature: ['litteratur', 'nobel-prize-in-literature', 'literature'],
  'Economic Sciences': ['økonomisk vitenskap', 'nobel-prize-economic-sciences', 'economic-sciences'],
};
for (const [en, [nb]] of Object.entries(categories)) patch.collections.push({ id: collections[en], title: en === 'Peace' ? 'Nobels fredspris' : en === 'Economic Sciences' ? 'Sveriges Riksbanks økonomipris' : `Nobelpriser i ${nb}`, subject: ['Physics','Chemistry','Physiology or Medicine'].includes(en) ? 'science' : en === 'Literature' ? 'literature' : en === 'Peace' ? 'history' : 'economics', description: `Komplett prisregister til og med ${endYear}, med utvalgte spørsmål som forbinder personer, bidrag og historisk sammenheng.` });
function addSource(id, title, url, license = 'CC0; offisiell Nobelpris-API. Vilkår: ' + laureateData.meta.license) {
  if (!baseSources.has(id) && !sources.has(id)) sources.set(id, { id, title, url, license, sourcedAt });
  return id;
}
const registrySource = addSource('nobel-api-directory', 'Offisielt Nobelprisregister — prisvinnere og prisår', 'https://api.nobelprize.org/2.1/laureates');
const prizeSource = addSource('nobel-api-prizes', 'Offisielt Nobelprisregister — priser og år uten tildeling', 'https://api.nobelprize.org/2.1/nobelPrizes');
addSource('nobel-api-license', 'Nobel Media — publisering av åpne data under CC0', 'https://www.mynewsdesk.com/us/nobelprize.org/pressreleases/open-data-about-the-nobel-prize-now-available-832152', 'Lisensdokumentasjon; ingen artikkeltekst kopiert.');
function entity(e) {
  const old = entities.get(e.id) || baseEntities.get(e.id);
  entities.set(e.id, old ? { ...e, ...old, collectionIds: [...new Set([...old.collectionIds, ...e.collectionIds])], sourceIds: [...new Set([...old.sourceIds, ...e.sourceIds])], nobelId: e.nobelId || old.nobelId, wikidataId: e.wikidataId || old.wikidataId, metadata: { ...old.metadata, ...e.metadata } } : e);
  return e.id;
}
function rel(from, to, type, context, sourceIds, year, metadata = {}) {
  const key = `${from}|${to}|${type}|${year || ''}`;
  const id = baseRelIds.get(key) || `nobel-relation-${hash(key).slice(0, 24)}`;
  const old = relationships.get(id);
  relationships.set(id, { id, from, to, type, context, sourceIds: [...new Set([...(old?.sourceIds || []), ...sourceIds])], confidence: 1, ...(year ? { year } : {}), ...metadata });
}
function memberships(cat) {
  return ['nobel', collections[cat], ...(['Physics','Chemistry','Physiology or Medicine'].includes(cat) ? ['science'] : cat === 'Literature' ? ['literature'] : cat === 'Peace' ? ['history'] : [])];
}
function country(place, cols, ss) {
  if (!place?.countryNow?.en && !place?.country?.en) return null;
  const current = place.countryNow || place.country;
  const wikidata = current.sameAs?.find(x => /wikidata.org\/wiki\/Q\d+$/.test(x))?.split('/').pop();
  const english = current.en;
  const countryLabels = { 'Q928': 'Filippinene', 'Q4628': 'Færøyene', 'Q17012': 'Guadeloupe', 'Q974': 'Den demokratiske republikken Kongo' };
  const label = countryLabels[wikidata] || getText(current);
  const overrides = { Norway: 'norway', Sweden: 'sweden', Denmark: 'denmark', Finland: 'finland', France: 'france', Germany: 'germany', Italy: 'italy', Spain: 'spain', Japan: 'japan', Canada: 'canada' };
  const id = overrides[english] || foundationIds.get(cleanName(getText(current))) || (wikidata ? `wikidata-${wikidata}` : `nobel-country-${slug(english)}`);
  return entity({ id, label, type: 'country-area', summary: 'Land- eller områdebetegnelse i Nobelprisregisterets nåværende geografiske referanse. Området er ikke nødvendigvis en selvstendig stat. Dette angir ikke prisvinnerens statsborgerskap.', collectionIds: cols, sourceIds: ss, wikidataId: wikidata });
}
const laureates = laureateData.laureates.filter(l => l.nobelPrizes.some(a => Number(a.awardYear) <= endYear));
const lByApi = new Map(), awardEvents = new Map();
for (const l of laureates) {
  const awards = l.nobelPrizes.filter(a => Number(a.awardYear) <= endYear);
  const name = getText(l.knownName || l.orgName || l.fullName).trim();
  if (!name) throw new Error('Laureate lacks a name: ' + l.id);
  const existingLaureates = { '845': 'barack-obama' };
  const preferred = existingLaureates[l.id];
  const id = (preferred && baseEntities.has(preferred) ? preferred : null) || foundationIds.get(cleanName(name)) || `nobel-laureate-${l.id}`;
  const ss = [addSource(`nobel-laureate-source-${l.id}`, `Nobelprisregisteret — ${name}`, `https://api.nobelprize.org/2.1/laureate/${l.id}`)];
  const cols = [...new Set(awards.flatMap(a => memberships(a.category.en)))];
  const awardSummary = awards.map(a => `${getText(a.category)} ${a.awardYear}`).join('; ');
  const birth = l.birth?.place?.locationString;
  const born = birth && l.birth?.year ? ` Født i ${getText(birth)} i ${l.birth.year}.` : '';
  entity({ id, label: name.replace(/^Sir /, ''), type: l.orgName ? 'organization' : 'person', summary: `Prisvinner: ${awardSummary}.${born}`, collectionIds: cols, sourceIds: ss, nobelId: l.id, wikidataId: l.wikidata?.id, metadata: { birthDate: l.birth?.date, foundedDate: l.founded?.date, birthPlaceHistorical: getText(l.birth?.place?.locationString), awardStatus: awards.map(a => ({ year: Number(a.awardYear), category: a.category.en, status: a.prizeStatus || 'received' })) } });
  lByApi.set(l.id, { id, name: entities.get(id).label, sourceIds: ss, raw: l, awards });
  const birthCountry = country(l.birth?.place, cols, ss);
  if (birthCountry) rel(id, birthCountry, 'birthplace-in-current-country', `Nobelprisregisteret plasserer fødestedet til ${name} i dette området etter nåværende geografisk inndeling. Dette angir ikke statsborgerskap.`, ss, undefined, { historicalCountry: getText(l.birth?.place?.country), birthYear: Number(l.birth?.year) || undefined });
  for (const award of awards) {
    const cat = award.category.en, [nb, categoryId, route] = categories[cat], year = Number(award.awardYear);
    entity({ id: categoryId, label: getText(award.categoryFullName), type: 'award', summary: cat === 'Economic Sciences' ? 'Sveriges Riksbanks pris i økonomisk vitenskap til minne om Alfred Nobel ble innført senere enn de opprinnelige Nobelprisene.' : `Nobelpriskategori: ${nb}.`, collectionIds: memberships(cat), sourceIds: ss });
    const eventId = `nobel-prize-${route}-${year}`;
    rel(id, categoryId, award.prizeStatus === 'received' ? 'received' : 'awarded', `${name} ble tildelt ${getText(award.categoryFullName)} for ${year}.`, ss, year, { awardStatus: award.prizeStatus, share: award.portion });
    rel(id, eventId, 'awarded-prize', `${name} er registrert som prisvinner i ${nb} for ${year}.`, ss, year, { awardStatus: award.prizeStatus, share: award.portion, motivationOriginal: award.motivation?.en?.replace(/<[^>]+>/g, '') || '' });
    for (const a of award.affiliations || []) {
      const institutionName = getText(a.name), city = getText(a.city), countryLabel = getText(a.country);
      if (!institutionName) continue;
      const institutionId = `nobel-institution-${hash(institutionName).slice(0, 20)}`;
      entity({ id: institutionId, label: institutionName, type: 'organization', summary: 'Institusjon oppført i Nobelprisregisteret ved pristildeling. Geografiske forbindelser viser opplysningene ved de registrerte tildelingene.', collectionIds: memberships(cat), sourceIds: ss });
      rel(id, institutionId, 'award-time-affiliation', `${name} var tilknyttet ${institutionName} slik Nobelprisregisteret oppgir for prisåret ${year}.`, ss, year);
      const co = country(a, memberships(cat), ss);
      if (co) rel(institutionId, co, 'located-in-country', `${institutionName} har registrert tilknytning til dette landet, omregnet til Nobelprisregisterets nåværende geografiske referanse. Historisk landnavn ved pristildeling: ${countryLabel}.`, ss);
    }
  }
}
const slots = prizeData.nobelPrizes.filter(a => Number(a.awardYear) <= endYear);
for (const a of slots) {
  const year = Number(a.awardYear), cat = a.category.en, [nb, categoryId, route] = categories[cat];
  const id = `nobel-prize-${route}-${year}`;
  const ss = [addSource(`nobel-prize-source-${route}-${year}`, `Nobelprisregisteret — ${nb} ${year}`, `https://api.nobelprize.org/2.1/nobelPrize/${({physics:'phy',chemistry:'che',medicine:'med',peace:'pea',literature:'lit','economic-sciences':'eco'})[route]}/${year}`, 'CC0; oppføring fra offisiell Nobelpris-API. Nettsidetekst og medier kopieres ikke.')];
  const recipients = (a.laureates || []).map(l => lByApi.get(l.id));
  if (recipients.some(x => !x)) throw new Error(`Missing laureate in ${id}`);
  entity({ id, label: `${cat === 'Peace' ? 'Nobels fredspris' : cat === 'Economic Sciences' ? 'Økonomiprisen til minne om Alfred Nobel' : 'Nobelprisen i ' + nb} ${year}`, type: 'award-event', summary: recipients.length ? `Tildelt ${recipients.map(x => x.name).join(', ')}.` : `Ingen pris ble tildelt i denne kategorien for ${year}.`, collectionIds: memberships(cat), sourceIds: ss, metadata: { awardYear: year, awardDate: a.dateAwarded, recipientCount: recipients.length, awarded: recipients.length > 0 } });
  if (!entities.has(categoryId) && !baseEntities.has(categoryId)) entity({ id: categoryId, label: getText(a.categoryFullName), type: 'award', summary: `Nobelpriskategori: ${nb}.`, collectionIds: memberships(cat), sourceIds: ss });
  rel(id, categoryId, 'award-category', `Prisregisterets oppføring gjelder kategorien ${nb} og prisåret ${year}.`, ss, year);
  awardEvents.set(`${route}:${year}`, { id, categoryId, cat, year, recipients, sourceIds: ss, raw: a });
}
// Each row is an editorial choice grounded in the award's official motivation.
// Last field restricts a contribution to the named share when motivations differ.
const curated = [
 ['physics',1901,'røntgenstråler','Oppdagelsen av røntgenstråler.'],
 ['physics',1903,'radioaktiv stråling','Undersøkelser av strålingsfenomenene som Becquerel hadde oppdaget.',['5','6']],
 ['chemistry',1911,'radium og polonium','Oppdagelsen av radium og polonium og videre undersøkelser av radium.'],
 ['physics',1918,'energikvanter','Oppdagelsen av energikvanter, anerkjent i Nobelprisen til Max Planck.'],
 ['physics',1921,'fotoelektrisk effekt','Loven for den fotoelektriske effekten.'],
 ['physics',1922,'atomstruktur','Undersøkelser av atomenes struktur og strålingen de sender ut.'],
 ['chemistry',1908,'radioaktiv nedbrytning','Undersøkelser av grunnstoffers nedbrytning og radioaktive stoffers kjemi.'],
 ['physics',1930,'spredning av lys','Undersøkelser av lysspredning og effekten som fikk navnet Raman-effekten.'],
 ['physics',1932,'kvantemekanikk','Utviklingen av kvantemekanikk.'],
 ['physics',1933,'kvanteteori for atomer','Nye former for atomteori, anerkjent i prisen til Schrödinger og Dirac.'],
 ['physics',1935,'nøytronet','Oppdagelsen av nøytronet.'],
 ['chemistry',1935,'kunstige radioaktive grunnstoffer','Fremstilling av nye radioaktive grunnstoffer.'],
 ['physics',1938,'langsomme nøytroner','Radioaktive grunnstoffer fremstilt ved nøytronbestråling og kjernereaksjoner med langsomme nøytroner.'],
 ['chemistry',1944,'kjernefysisk fisjon','Oppdagelsen av spalting av tunge atomkjerner.'],
 ['medicine',1945,'penicillin','Oppdagelsen av penicillin og dets virkning mot infeksjonssykdommer.'],
 ['chemistry',1954,'kjemiske bindinger','Undersøkelser av kjemiske bindinger og strukturen til komplekse stoffer.'],
 ['physics',1956,'transistoren','Undersøkelser av halvledere og oppdagelsen av transistoreffekten.'],
 ['chemistry',1958,'insulinets struktur','Undersøkelser av proteiners struktur, særlig insulin.'],
 ['medicine',1962,'nukleinsyrenes molekylstruktur','Undersøkelser av nukleinsyrenes struktur og betydning for informasjonsoverføring i levende materiale.'],
 ['physics',1963,'atomkjernens skallstruktur','Oppdagelser om atomkjernens skallstruktur.',['79','80']],
 ['chemistry',1964,'røntgenanalyse av biokjemiske strukturer','Bestemmelse av viktige biokjemiske stoffers struktur med røntgenteknikker.'],
 ['physics',1965,'kvanteelektrodynamikk','Grunnleggende arbeid innen kvanteelektrodynamikk og elementærpartikkelfysikk.'],
 ['medicine',1968,'den genetiske koden','Tolkning av den genetiske koden og dens rolle i proteinsyntesen.'],
 ['physics',1972,'BCS-teorien','En felles utviklet teori om superledning, kalt BCS-teorien.'],
 ['chemistry',1980,'sekvensering av nukleinsyrer','Metoder for å bestemme rekkefølgen av baser i nukleinsyrer.',['222','255']],
 ['medicine',1983,'bevegelige genetiske elementer','Oppdagelsen av bevegelige genetiske elementer.'],
 ['physics',1983,'stjerners struktur og utvikling','Teoretiske undersøkelser av fysiske prosesser som er viktige for stjernenes struktur og utvikling.',['122']],
 ['medicine',2005,'Helicobacter pylori','Oppdagelsen av bakterien Helicobacter pylori og dens rolle ved gastritt og magesår.'],
 ['medicine',2009,'telomerer og telomerase','Hvordan kromosomer beskyttes av telomerer og enzymet telomerase.'],
 ['chemistry',2009,'ribosomet','Undersøkelser av ribosomets struktur og funksjon.'],
 ['physics',2010,'grafen','Eksperimenter med det todimensjonale materialet grafen.'],
 ['medicine',2012,'omprogrammering av modne celler','Oppdagelsen av at modne celler kan omprogrammeres til å bli pluripotente.'],
 ['physics',2013,'mekanismen bak elementærpartiklers masse','En teoretisk mekanisme som forklarer opprinnelsen til masse hos subatomære partikler.'],
 ['physics',2014,'blå lysdioder','Effektive blå lysdioder som muliggjorde klare, energisparende hvite lyskilder.'],
 ['medicine',2014,'hjernens posisjonssystem','Oppdagelsen av celler som utgjør et posisjonssystem i hjernen.'],
 ['medicine',2015,'behandling mot malaria','Oppdagelser om en ny behandling mot malaria.',['918']],
 ['medicine',2016,'autofagi','Oppdagelser om mekanismer for autofagi.'],
 ['physics',2017,'gravitasjonsbølger','Avgjørende bidrag til LIGO-detektoren og observasjon av gravitasjonsbølger.'],
 ['chemistry',2019,'litiumionbatterier','Utviklingen av litiumionbatterier.'],
 ['chemistry',2020,'genomredigering','Utviklingen av en metode for å redigere genomer.'],
 ['physics',2020,'dannelse av svarte hull','Oppdagelsen av at dannelse av svarte hull følger robust av generell relativitetsteori.',['988']],
 ['physics',2020,'kompakt objekt i Melkeveiens sentrum','Oppdagelsen av et supermassivt kompakt objekt i sentrum av galaksen vår.',['989','990']],
 ['medicine',2023,'mRNA-vaksiner','Oppdagelser om endringer av nukleosidbaser som muliggjorde effektive mRNA-vaksiner mot covid-19.'],
 ['chemistry',2025,'metallorganiske rammeverk','Utviklingen av metallorganiske rammeverk.'],
 ['physics',2025,'kvantetunnelering i elektriske kretser','Oppdagelsen av makroskopisk kvantemekanisk tunnelering og energikvantisering i en elektrisk krets.'],
 ['medicine',2025,'perifer immuntoleranse','Oppdagelser om perifer immuntoleranse.'],
 ['peace',1964,'ikkevoldelig kamp for borgerrettigheter','Ikkevoldelig kamp for afroamerikaneres borgerrettigheter.'],
 ['peace',1962,'kamp mot atomkappløpet','Motstand mot atomvåpenkappløpet mellom øst og vest.'],
 ['peace',1953,'Marshallplanen','Forslag og oppfølging av planen for Europas økonomiske gjenreisning.'],
 ['peace',1993,'fredelig avvikling av apartheid','Arbeid for en fredelig avvikling av apartheid og grunnlaget for et demokratisk Sør-Afrika.'],
 ['peace',2004,'bærekraft, demokrati og fred','Bidrag til bærekraftig utvikling, demokrati og fred.'],
 ['peace',2014,'barns rett til utdanning','Kamp mot undertrykkelse av barn og unge og for alle barns rett til utdanning.'],
 ['peace',2017,'forbud mot atomvåpen','Arbeid for oppmerksomhet om atomvåpens humanitære konsekvenser og for et traktatfestet forbud.'],
 ['literature',1920,'Markens grøde','Det monumentale verket Markens grøde.'],
 ['literature',1928,'nordisk middelalderliv','Sterke skildringer av nordisk liv i middelalderen.'],
 ['literature',1982,'fantastisk og realistisk fortelling','Romaner og noveller som forener det fantastiske og det realistiske og speiler et kontinents liv og konflikter.'],
 ['literature',1993,'afroamerikansk livserfaring','Romaner preget av visjonær kraft og poetisk betydning som belyser en vesentlig side av amerikansk virkelighet.'],
 ['literature',2016,'poetiske uttrykk i sangtradisjonen','Nye poetiske uttrykk innenfor den amerikanske sangtradisjonen.'],
 ['literature',2023,'dramatikk og prosa','Nyskapende dramatikk og prosa som gir uttrykk for det som vanskelig lar seg si.'],
 ['economic-sciences',2001,'asymmetrisk informasjon','Analyser av markeder med asymmetrisk informasjon.'],
 ['economic-sciences',2002,'psykologi i økonomi','Integrering av psykologisk forskning i økonomi, særlig vurderinger og beslutninger under usikkerhet.',['759']],
 ['economic-sciences',2009,'forvaltning av felleseide ressurser','Analyser av økonomisk styring, særlig felleseide ressurser.',['846']],
 ['economic-sciences',2023,'kvinners arbeidsmarkedsutfall','En bedre forståelse av kvinners utfall i arbeidsmarkedet.'],
];
const timelineItems = [];
const nameOrders = names => names.length < 2 ? [names] : names.flatMap((name, i) => nameOrders(names.filter((_, j) => i !== j)).map(rest => [name, ...rest]));
for (const [route, year, conceptLabel, contribution, onlyIds] of curated) {
  const event = awardEvents.get(`${route}:${year}`);
  if (!event) throw new Error(`Missing curated prize ${route} ${year}`);
  const selected = onlyIds ? event.recipients.filter(r => onlyIds.includes(r.raw.id)) : event.recipients;
  if (!selected.length || (onlyIds && selected.length !== onlyIds.length)) throw new Error(`Incorrect selected laureate IDs: ${route}:${year} ${onlyIds}`);
  const conceptId = foundationIds.get(cleanName(conceptLabel)) || `nobel-concept-${slug(conceptLabel)}`;
  const cols = memberships(event.cat), ss = [...new Set([...event.sourceIds, ...selected.flatMap(x => x.sourceIds)])];
  entity({ id: conceptId, label: conceptLabel, type: route === 'literature' && year === 1920 ? 'literary-work' : 'concept', summary: contribution, collectionIds: cols, sourceIds: ss });
  const names = selected.map(r => r.name), people = names.join(', ');
  for (const person of selected) rel(person.id, conceptId, 'recognized-for', `${person.name} ble anerkjent i prisåret ${year} for: ${contribution}`, ss, year);
  rel(event.id, conceptId, 'recognized-contribution', contribution, ss, year);
  const scientific = ['physics','chemistry','medicine'].includes(route);
  const context = scientific ? 'Knytt en vitenskapelig idé til arbeidet som ble anerkjent. Nobelprisåret er ikke nødvendigvis oppdagelsesåret.' : route === 'literature' ? 'Knytt forfatterskapet til begrunnelsen for den litterære anerkjennelsen.' : route === 'peace' ? 'Knytt fredsarbeidet til den konkrete samfunnsendringen som ble anerkjent.' : 'Knytt økonomisk forskning til spørsmålet den undersøker.';
  const explanation = `${people} ble tildelt prisen for ${year}. Begrunnelsen fremhever: ${contribution}`;
  const kind = 'connections';
  const common = { entityId: conceptId, collectionIds: cols, explanation, sourceIds: ss, kind, difficulty: 3, significance: 4, year, context, followUp: 'Prisen er en historisk anerkjennelse av et bidrag. Hold selve idéen, forskerens øvrige arbeid og prisåret som separate, sammenknyttede holdepunkter.' };
  patch.targets.push({ ...common, id: `nobel-contribution-${route}-${year}-${slug(conceptLabel)}`, prompt: `Hva ble ${people} anerkjent for i ${route === 'peace' ? 'fredsprisen' : route === 'economic-sciences' ? 'økonomiprisen' : 'Nobelprisen'} for ${year}?`, answer: conceptLabel, acceptedAnswers: [contribution, ...new Set(selected.map(r => r.awards.find(a => Number(a.awardYear) === year && categories[a.category.en][2] === route)?.motivation?.en?.replace(/<[^>]+>/g, '')).filter(Boolean))] });
  patch.targets.push({ ...common, id: `nobel-year-${route}-${year}-${slug(conceptLabel)}`, prompt: `Hvilket prisår ble ${people} anerkjent for ${conceptLabel}?`, answer: String(year), acceptedAnswers: [], kind: 'recall', context: 'Plasser anerkjennelsen på tidslinjen. Spørsmålet gjelder prisåret, ikke nødvendigvis året arbeidet begynte.' });
  patch.targets.push({ ...common, id: `nobel-people-${route}-${year}-${slug(conceptLabel)}`, prompt: `${selected.length > 1 ? 'Hvilke prisvinnere' : 'Hvilken prisvinner'} ble anerkjent i ${year} for ${conceptLabel}?`, answer: people, ...(selected.length > 1 ? { answerFormat: 'explanation' } : {}), acceptedAnswers: selected.length === 1 ? [selected[0].raw.knownName?.en || selected[0].raw.orgName?.en || people] : [...new Set(nameOrders(names).flatMap(order => [order.join(', '), order.join(' og '), order.join('; '), new Intl.ListFormat('nb', { style: 'long', type: 'conjunction' }).format(order)]))], context: scientific ? 'Hent fram hvem som står bak bidraget. Flere kan ha blitt anerkjent sammen; husk hele den oppgitte gruppen.' : 'Hent fram personen eller organisasjonen bak bidraget.', kind: 'recall' });
  if (scientific) timelineItems.push({ id: event.id + '-' + slug(conceptLabel), entityId: conceptId, label: `${conceptLabel} — pris til ${people}`, year });
}
patch.timelines.push({ id: 'nobel-scientific-recognition-timeline', title: 'Vitenskapelig anerkjennelse — Nobelprisår', collectionIds: ['science','nobel'], items: timelineItems.sort((a,b) => a.year-b.year || a.id.localeCompare(b.id)), sourceIds: [registrySource, prizeSource] });
for (const target of patch.targets) target.answerType = target.id.startsWith('nobel-year-') ? 'year' : target.id.startsWith('nobel-people-') ? (target.answerFormat === 'explanation' ? 'person-list' : 'person') : 'contribution';
patch.entities = [...entities.values()]; patch.relationships = [...relationships.values()]; patch.sources = [...sources.values()];
patch.coverage = { firstAwardYear: 1901, finalAwardYear: endYear, distinctLaureates: laureates.length, laureateAwardPairs: laureates.reduce((n,l) => n+l.nobelPrizes.filter(a => Number(a.awardYear)<=endYear).length,0), prizeSlots: slots.length, awardedPrizeSlots: slots.filter(a=>a.laureates?.length).length, notAwardedPrizeSlots: slots.filter(a=>!a.laureates?.length).length, curatedContributions: curated.length, retrievalTargets: patch.targets.length, excludedLaterAwardYears: true, rawSnapshots: [{path: 'knowledge-build/sources/nobel-laureates.json',sha256:hash(rawLaureates),records:laureateData.laureates.length},{path:'knowledge-build/sources/nobel-prizes.json',sha256:hash(rawPrizes),records:prizeData.nobelPrizes.length}], sourceLicenseUrl: laureateData.meta.license };
// Verify the patch against itself plus the installed foundation before publication.
const merged = Object.fromEntries(['collections','entities','relationships','targets','sources','timelines'].map(section => [section, [...new Map([...foundation[section],...patch[section]].map(item=>[item.id,item])).values()]]));
const {validatePackage} = await import('./validate-knowledge.mjs');
const result = validatePackage({ ...foundation, ...merged, entityCount: merged.entities.length, relationshipCount: merged.relationships.length, targetCount: merged.targets.length });
if (!result.valid) throw new Error(result.errors.join('\n'));
await writeFile('knowledge-build/nobel-science.json.tmp', JSON.stringify(patch,null,2)+'\n');
await rename('knowledge-build/nobel-science.json.tmp','knowledge-build/nobel-science.json');
console.log(JSON.stringify({coverage:patch.coverage,patchCounts:Object.fromEntries(['entities','relationships','targets','sources'].map(k=>[k,patch[k].length])),mergedCounts:result.counts},null,2));

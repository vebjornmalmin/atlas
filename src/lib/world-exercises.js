import {shortestBorderPath} from './world-graph.js';
import {hasFlag} from './flags.js';

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
const pick = (rows, seed, count) => [...rows].sort((a, b) => hash(seed + (a.id ?? a)) - hash(seed + (b.id ?? b))).slice(0, count);
const list = labels => labels.length < 2 ? labels.join('') : `${labels.slice(0, -1).join(', ')} og ${labels.at(-1)}`;
export const formatYearsAgo = years => years >= 1e9 ? `ca. ${String(+(years / 1e9).toFixed(1)).replace('.', ',')} mrd. år siden`
  : years >= 1e6 ? `ca. ${String(+(years / 1e6).toFixed(1)).replace('.', ',')} mill. år siden`
  : `ca. ${Math.round(years).toLocaleString('nb-NO')} år siden`;
const DEMONYMS = {NOR:['norsk','nordmenn'],SWE:['svensk'],DNK:['dansk'],FIN:['finsk'],DEU:['tysk'],FRA:['fransk'],GBR:['britisk'],USA:['amerikansk'],RUS:['russisk'],UKR:['ukrainsk'],CHN:['kinesisk'],JPN:['japansk'],IND:['indisk'],ISR:['israelsk'],IRN:['iransk'],PSE:['palestinsk'],BRA:['brasiliansk'],CAN:['kanadisk'],MEX:['meksikansk'],TUR:['tyrkisk'],POL:['polsk'],ITA:['italiensk'],ESP:['spansk'],VEN:['venezuelansk'],ARG:['argentinsk'],ZAF:['sørafrikansk'],NGA:['nigeriansk'],EGY:['egyptisk'],SAU:['saudi'],KOR:['sørkoreansk','koreansk'],PRK:['nordkoreansk'],PAK:['pakistansk'],AFG:['afghansk'],SYR:['syrisk'],SDN:['sudansk'],ETH:['etiopisk'],KEN:['kenyansk'],AUS:['australsk']};
const reveals = (text, entity) => {
  const lower = String(text).toLocaleLowerCase('nb');
  const stem = entity.label.toLocaleLowerCase('nb').slice(0, entity.label.length <= 5 ? 3 : 4);
  return lower.includes(stem) || (DEMONYMS[entity.iso3] || []).some(word => lower.includes(word));
};

/** Targets for the ten world formats. They follow the same shape as the other generated quiz formats. */
export function buildWorldTargets(data, graph) {
  if (!data.perspectives?.lenses?.length) return [];
  const {byId, adjacency, neighbours, lenses} = graph;
  const result = [];
  const regionOf = id => adjacency.get(id).find(l => ['located-in', 'in-region'].includes(l.relation.type) && byId.get(l.other)?.type === 'region')?.other;
  const capitalOf = id => adjacency.get(id).find(l => l.relation.type === 'capital-of' && !l.outgoing)?.other;
  const impact = id => data.perspectives.impact?.[id] ?? 0;
  const countries = graph.countries.filter(c => hasFlag(c.iso2));
  const peers = new Map();
  for (const c of countries) { const r = regionOf(c.id) || 'none'; if (!peers.has(r)) peers.set(r, []); peers.get(r).push(c); }
  const natural = graph.data.sources.find(s => s.title.startsWith('Natural Earth'))?.id;
  const sourcesOf = id => byId.get(id)?.sourceIds.slice(0, 3) || [];
  const describe = c => {
    const capital = byId.get(capitalOf(c.id))?.label;
    const near = (neighbours.get(c.id) || []).map(id => byId.get(id).label).sort((a, b) => a.localeCompare(b, 'nb'));
    return `${capital ? `Hovedstaden er ${capital}. ` : ''}${near.length ? `${c.label} grenser til ${list(near)}.` : `${c.label} har ingen landegrenser på kartgrunnlaget.`}`;
  };

  // 1. Flags, both directions.
  const known = new Set([...countries].sort((a, b) => impact(b.id) - impact(a.id)).slice(0, 60).map(c => c.id));
  for (const c of countries) {
    const group = (peers.get(regionOf(c.id) || 'none') || []).filter(o => o.id !== c.id);
    const others = pick(group.length >= 3 ? group : countries.filter(o => o.id !== c.id), `flag:${c.id}`, 3);
    const familiar = known.has(c.id) || c.id === 'norway' || regionOf(c.id) === 'northern-europe';
    result.push({id:`flag:${c.iso3}`, format:'flags', mode:'recognition', kind:'recognition', entityId:c.id, collectionIds:['flags-borders'],
      prompt:'Hvilket land har dette flagget?', visual:{flag:c.iso2}, answer:c.label, acceptedAnswers:[c.officialName].filter(Boolean),
      options:others.map(o => o.label), explanation:`Dette er flagget til ${c.label}. ${describe(c)}`,
      sourceIds:sourcesOf(c.id), difficulty:familiar ? 2 : 3, significance:familiar ? 4 : 2, familiar});
    if (familiar) result.push({id:`flag-choice:${c.iso3}`, format:'flags', mode:'pick', kind:'recognition', entityId:c.id, collectionIds:['flags-borders'],
      prompt:`Hvilket flagg tilhører ${c.label}?`, choices:pick([c, ...others], `choice:${c.id}`, 4).map(o => ({id:o.id, iso2:o.iso2, label:o.label})), correctId:c.id,
      answer:`Flagget til ${c.label}`, acceptedAnswers:[], explanation:`${c.label} har dette flagget. ${describe(c)}`,
      sourceIds:sourcesOf(c.id), difficulty:2, significance:3, familiar});
  }

  // 2. Neighbours: exactly one option shares a land border.
  for (const c of countries) {
    const near = neighbours.get(c.id) || [];
    if (!near.length) continue;
    const group = (peers.get(regionOf(c.id) || 'none') || []).filter(o => o.id !== c.id && !near.includes(o.id));
    if (group.length < 3) continue;
    const answer = byId.get(pick(near, `neighbour:${c.id}`, 1)[0]);
    result.push({id:`neighbour:${c.iso3}`, format:'neighbours', mode:'recognition', kind:'recognition', entityId:c.id, collectionIds:['flags-borders'],
      prompt:`Hvilket av disse landene grenser til ${c.label}?`, answer:answer.label, acceptedAnswers:[], options:pick(group, `distractor:${c.id}`, 3).map(o => o.label),
      explanation:describe(c), sourceIds:[natural].filter(Boolean), difficulty:3, significance:known.has(c.id) ? 3 : 2});
  }

  // 3. Journeys over land between neighbours.
  const byIso3 = new Map(countries.map(c => [c.iso3, c.id]));
  const journeys = [['NOR','ITA'],['NOR','ESP'],['NOR','CHN'],['NOR','TUR'],['NOR','IND'],['NOR','GRC'],['NOR','FRA'],['ESP','POL'],['PRT','DEU'],['EGY','ZAF'],['MAR','EGY'],
    ['KEN','NGA'],['MEX','ARG'],['CAN','COL'],['VNM','TUR'],['FIN','HUN'],['IRN','CHN'],['SEN','COD'],['BRA','VEN'],['UKR','IRN'],['SWE','POL'],['THA','IND']]
    .map(pair => pair.map(code => byIso3.get(code)));
  for (const [from, to] of journeys) {
    const path = from && to ? shortestBorderPath(graph, from, to) : null;
    if (!path || path.length < 3 || path.length > 8) continue;
    const labels = path.map(id => byId.get(id).label);
    result.push({id:`border-walk:${from}:${to}`, format:'border-walk', mode:'border-walk', kind:'connections', entityId:from, collectionIds:['flags-borders'], datasetId:'world',
      prompt:`Reis over land fra ${labels[0]} til ${labels.at(-1)}. Velg ett naboland om gangen.`, start:from, goal:to, shortest:path.length - 1,
      answer:labels.join(' → '), acceptedAnswers:[], explanation:`Den korteste reisen på kartgrunnlaget krysser ${path.length - 1} landegrenser: ${labels.join(' → ')}. Andre ruter med like mange grenser godtas. Grensene gjelder i dag.`,
      sourceIds:[natural].filter(Boolean), difficulty:4, significance:3});
  }

  // 4. News on the map. The headline must not name the country being asked for.
  for (const item of graph.news) {
    const place = byId.get(item.metadata.primaryEntityId);
    // Global stories (a UN report, say) have no single country to find, even if one hosts the follow-up.
    if (!place?.geo || place.id === 'norway' || item.metadata.globalStory || reveals(item.label, place)) continue;
    const date = new Date(`${item.metadata.date}T12:00:00Z`).toLocaleDateString('nb-NO', {day:'numeric', month:'long'});
    result.push({id:`news-map:${item.id}`, format:'news-map', mode:'map', kind:'recognition', entityId:place.id, collectionIds:['current-affairs'], datasetId:'world', regionId:place.geo.mapRegionId,
      prompt:`${date}: «${item.label}». Finn landet saken handler om.`, answer:place.label, acceptedAnswers:[], newsId:item.id,
      explanation:`${item.summary}${item.metadata.background ? ` ${item.metadata.background}` : ''} Kilde: ${item.metadata.publisher}.`,
      sourceIds:item.sourceIds, difficulty:2, significance:Math.min(5, item.metadata.impact || 3)});
  }

  // 5. The question each lens asks.
  const lensNames = lenses.map(l => l.name);
  for (const lens of lenses) {
    result.push({id:`lens-question:${lens.id}`, format:'lens-question', mode:'recognition', kind:'recognition', entityId:lens.entityId, collectionIds:['world-lenses'],
      prompt:`Hvilket historiesyn stiller spørsmålet: «${lens.question}»`, answer:lens.name, acceptedAnswers:[], options:pick(lensNames.filter(n => n !== lens.name), lens.id, 3),
      explanation:`${lens.summary} Sentrale stemmer: ${list(lens.thinkerIds.map(id => byId.get(id)?.label).filter(Boolean).slice(0, 3))}.`,
      sourceIds:sourcesOf(lens.entityId), difficulty:2, significance:4});
  }

  // 6. Thinkers, their works, ideas and lenses.
  const thinkers = data.entities.filter(e => e.type === 'person' && e.collectionIds.includes('world-lenses') && e.metadata?.role === 'historian');
  const firstLink = (id, type, outgoing = true) => adjacency.get(id).filter(l => l.relation.type === type && l.outgoing === outgoing).map(l => byId.get(l.other));
  for (const [kind, type, prompt] of [['work', 'author-of', 'Koble hver tenker til verket.'], ['concept', 'proposed', 'Koble hver tenker til begrepet.']]) {
    const rows = thinkers.map(t => ({t, item:firstLink(t.id, type).sort((a, b) => a.label.localeCompare(b.label))[0]})).filter(r => r.item);
    const used = new Set(), unique = rows.filter(r => !used.has(r.item.id) && used.add(r.item.id));
    const ordered = pick(unique.map(r => ({...r, id:r.t.id})), kind, unique.length);
    for (let i = 0; i + 3 <= ordered.length; i += 3) {
      const batch = ordered.slice(i, i + 3);
      result.push({id:`thinkers:${kind}:${batch[0].t.id}`, format:'thinkers', mode:'matching', kind:'connections', entityId:batch[0].t.id, collectionIds:['world-lenses'], prompt,
        pairs:batch.map(r => ({id:r.t.id, label:r.t.label, answer:r.item.label})), answer:batch.map(r => `${r.t.label}: ${r.item.label}`).join(' · '),
        explanation:batch.map(r => `${r.t.label}: ${r.item.label}${r.item.metadata?.year ? ` (${r.item.metadata.year})` : ''}.`).join(' '),
        sourceIds:[...new Set(batch.flatMap(r => sourcesOf(r.item.id)))], difficulty:3, significance:3});
    }
  }
  for (const t of thinkers) {
    const own = firstLink(t.id, 'shaped-lens');
    if (own.length !== 1) continue;
    result.push({id:`lens-thinker:${t.id}`, format:'thinkers', mode:'recognition', kind:'recognition', entityId:t.id, collectionIds:['world-lenses'],
      prompt:`${t.label} er en sentral stemme i hvilket historiesyn?`, answer:own[0].label, acceptedAnswers:[], options:pick(lensNames.filter(n => n !== own[0].label), t.id, 3),
      explanation:`${t.summary} ${own[0].summary}`, sourceIds:sourcesOf(t.id), difficulty:3, significance:3});
  }

  // 7. Hayden White's readings in Metahistory.
  const vocab = data.perspectives.metahistory?.vocabulary || {};
  const groupOf = {emplotment:'emplotments', trope:'tropes', argument:'arguments', ideology:'ideologies'};
  const nounOf = {emplotment:'plotform', trope:'trope', argument:'argumentasjonsform', ideology:'ideologisk implikasjon'};
  for (const a of data.perspectives.metahistory?.assignments || []) {
    const terms = vocab[groupOf[a.field]] || [];
    const term = terms.find(t => t.id === a.termId), thinker = byId.get(a.thinkerId);
    if (!term || !thinker || terms.length < 3 || a.confidence !== 'high') continue;
    const relation = adjacency.get(thinker.id).find(l => l.relation.type === 'emplotted-as' && l.relation.field === a.field)?.relation;
    result.push({id:`emplotment:${thinker.id}:${a.field}`, format:'emplotment', mode:'recognition', kind:'recognition', entityId:thinker.id, collectionIds:['world-lenses'],
      prompt:`I Metahistory (1973) leste Hayden White ${thinker.label}. Hvilken ${nounOf[a.field]} fant han?`, answer:term.label, acceptedAnswers:[],
      options:terms.filter(t => t.id !== term.id).map(t => t.label), explanation:`${relation?.context || ''} ${byId.get(term.entityId)?.summary || ''}`.trim(),
      evidenceStatus:a.confidence === 'high' ? 'documented' : 'uncertain', sourceIds:relation?.sourceIds || [], difficulty:4, significance:3});
  }

  // 8. Ladders of cosmic time and of distance from home.
  const thresholds = data.perspectives.thresholds || [];
  for (let i = 0; i + 4 <= thresholds.length; i += 2) {
    const items = thresholds.slice(i, i + 4).map(t => ({id:t.id, entityId:t.id, label:t.label, year:-t.approxYearsAgo, display:formatYearsAgo(t.approxYearsAgo)}));
    result.push({id:`scale:big-history:${i}`, format:'scale', mode:'timeline', kind:'before-after', entityId:items[0].id, collectionIds:['world-lenses'],
      prompt:'Ordne tersklene i Big History fra tidligst til senest.', timeline:{id:`big-history:${i}`, items}, answer:items.map(t => `${t.label} (${t.display})`).join(' → '), acceptedAnswers:[],
      explanation:'David Christian beskriver historien som terskler der mer komplekse former oppstår. Årstallene er avrundede anslag.', sourceIds:sourcesOf(items[0].id), difficulty:4, significance:3});
  }
  const far = [...countries].filter(c => known.has(c.id)).sort((a, b) => a.geo.distanceKm - b.geo.distanceKm);
  for (let start = 0; start < 6; start++) {
    const chosen = []; let last = -Infinity;
    for (const c of pick(far, `distance:${start}`, far.length).sort((a, b) => a.geo.distanceKm - b.geo.distanceKm)) {
      if (c.geo.distanceKm > last * 1.6 + 300 && c.id !== 'norway') { chosen.push(c); last = c.geo.distanceKm; }
      if (chosen.length === 4) break;
    }
    if (chosen.length < 4) continue;
    const items = chosen.map(c => ({id:c.id, entityId:c.id, label:c.label, year:c.geo.distanceKm, display:`ca. ${c.geo.distanceKm.toLocaleString('nb-NO')} km`}));
    result.push({id:`scale:distance:${start}`, format:'scale', mode:'timeline', kind:'before-after', entityId:chosen[0].id, collectionIds:['flags-borders'],
      prompt:'Ordne landene fra nærmest til fjernest fra Oslo. Øverst er nærmest.', timeline:{id:`distance:${start}`, items}, answer:items.map(t => `${t.label} (${t.display})`).join(' → '), acceptedAnswers:[],
      explanation:'Avstanden er målt i luftlinje fra Oslo til landets geografiske midtpunkt på kartet, avrundet. Store land kan ha deler som ligger mye nærmere eller lenger unna.', sourceIds:[natural].filter(Boolean), difficulty:3, significance:2});
  }

  // 9. Where laureates were recognised when they worked outside their country of birth.
  const flowsFrom = new Map();
  for (const r of data.relationships) if (r.type === 'knowledge-flow') { if (!flowsFrom.has(r.from)) flowsFrom.set(r.from, []); flowsFrom.get(r.from).push(r); }
  const hosts = Object.entries(data.perspectives.countryStats || {}).sort((a, b) => b[1].inflow - a[1].inflow).map(([id]) => id).filter(id => byId.get(id));
  for (const [from, rows] of flowsFrom) {
    const sorted = [...rows].sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, r) => sum + r.count, 0);
    if (total < 4 || (sorted[1] && sorted[1].count === sorted[0].count)) continue;
    const answer = byId.get(sorted[0].to), origin = byId.get(from);
    result.push({id:`knowledge-flow:${from}`, format:'knowledge-flow', mode:'recognition', kind:'connections', entityId:from, collectionIds:['world-lenses'],
      prompt:`Noen Nobelprisvinnere født i ${origin.label} arbeidet i et annet land da de fikk prisen. Hvilket land var oftest vertsland?`, answer:answer.label, acceptedAnswers:[],
      options:pick(hosts.slice(0, 15).filter(id => id !== answer.id && id !== from), from, 3).map(id => byId.get(id).label),
      explanation:`${sorted.slice(0, 3).map(r => `${byId.get(r.to).label}: ${r.count}`).join(', ')}. Tilknytning ved tildelingen er ikke det samme som utvandring eller statsborgerskap.`,
      sourceIds:['nobel-api-directory'], difficulty:4, significance:3});
  }

  // 10. The same place or person seen through different lenses.
  for (const r of data.relationships) {
    if (r.type !== 'views-through' || byId.get(r.to)?.type === 'threshold') continue;
    const lens = lenses.find(l => l.entityId === r.from), entity = byId.get(r.to);
    // The statement must not name the lens itself, in Norwegian or by its school name (such as Annales).
    if (!lens || !entity) continue;
    const giveaways = [...lens.name.split(/\s+/), ...lens.id.split('-')].filter(word => word.length > 4).map(word => word.toLocaleLowerCase('nb'));
    if (giveaways.some(word => r.context.toLocaleLowerCase('nb').includes(word))) continue;
    result.push({id:`perspective:${lens.id}:${entity.id}`, format:'perspective-switch', mode:'recognition', kind:'connections', entityId:entity.id, collectionIds:['world-lenses'],
      prompt:`${entity.label}: «${r.context}» Hvilket historiesyn ser slik på det?`, answer:lens.name, acceptedAnswers:[], options:pick(lensNames.filter(n => n !== lens.name), r.id, 3),
      explanation:`${lens.name} spør: «${lens.question}» ${lens.critique ? `Kritikk: ${lens.critique}` : ''}`.trim(), sourceIds:r.sourceIds, difficulty:3, significance:3});
  }
  return result;
}

export function gradeBorderWalk(target, path = [], neighbours) {
  const steps = [target.start, ...path];
  const valid = steps.every((id, i) => !i || (neighbours.get(steps[i - 1]) || []).includes(id));
  const arrived = steps.at(-1) === target.goal;
  return {correct: valid && arrived && path.length <= target.shortest + 1, valid, arrived, crossings: path.length, shortest: target.shortest};
}

import {writeFile} from 'node:fs/promises';
import {taughtBefore} from '../src/lib/core-curriculum.js';
import {readCoreDomains} from './core-files.mjs';

// Editorial overview of the curriculum: balance per unit and what still needs a person's judgement.
const domains = await readCoreDomains();
const report = {generated: 'build', domains: []};
const totals = {units: 0, cards: 0, byType: {}, byStep: {}};
for (const file of domains) {
  const domain = {id: file.domain.id, title: file.domain.title, units: []};
  for (const unit of file.units) {
    const byType = {}, byStep = {};
    for (const card of unit.cards) {
      byType[card.type] = (byType[card.type] || 0) + 1; byStep[card.step] = (byStep[card.step] || 0) + 1;
      totals.byType[card.type] = (totals.byType[card.type] || 0) + 1; totals.byStep[card.step] = (totals.byStep[card.step] || 0) + 1;
    }
    const untaught = unit.cards.filter(card => !taughtBefore(unit, card)).map(card => card.id);
    domain.units.push({id: unit.id, title: unit.title, tier: unit.tier, prerequisites: unit.prerequisites, cards: unit.cards.length, byStep, byType,
      lessonWords: unit.lesson.join(' ').split(/\s+/).length, sources: unit.sources.length, untaught});
    totals.units++; totals.cards += unit.cards.length;
  }
  report.domains.push(domain);
}
report.totals = totals;
await writeFile('docs/core-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(totals));

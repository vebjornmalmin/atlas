import {readFile,writeFile} from 'node:fs/promises';
import {assessDifficulty} from '../src/lib/difficulty.js';
import {foundationTargets} from '../src/lib/foundations.js';
const data=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
const rows=[...data.targets,...foundationTargets(data)].map(t=>({id:t.id,prompt:t.prompt,answer:t.answer,entityId:t.entityId,previousDifficulty:t.difficulty,...assessDifficulty(t)}));
const unreviewed=rows.filter(t=>t.difficultyFamily==='unreviewed');
if(unreviewed.length)throw new Error('Unreviewed families: '+unreviewed.map(t=>t.id).join(', '));
const families={};for(const row of rows){const key=row.difficultyFamily;families[key]??={count:0,difficulty:row.difficulty,stage:row.learningStage,reason:row.difficultyReason};families[key].count++;}
await writeFile('docs/difficulty-audit.json',JSON.stringify({policy:'2026-10-11',method:'Gjennomgang etter oppgavetype og nødvendige forkunnskaper. Redaksjonelle anslag, ikke målt vanskelighetsgrad.',baseQuestions:data.targets.length,introductions:rows.length-data.targets.length,families,questions:rows},null,2)+'\n');
console.log(JSON.stringify({total:rows.length,families},null,2));

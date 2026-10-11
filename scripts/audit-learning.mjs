import {readFile,writeFile} from 'node:fs/promises';
import {learningCoverage} from '../src/lib/learning-coverage.js';
import {foundationTargets} from '../src/lib/foundations.js';
import {attachKnowledge} from '../src/lib/knowledge-model.js';
const data=JSON.parse(await readFile('public/knowledge/foundation.json','utf8'));
const targets=attachKnowledge([...data.targets,...foundationTargets(data)],data);
const report={modelVersion:1,scope:'Dekning beskriver innholdet og utvalgte læringsmål, ikke mestring eller full fagdekning.',collections:learningCoverage(data,targets)};
await writeFile('docs/learning-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({topics:report.collections.length,curatedTopics:report.collections.filter(c=>c.paths).length}));

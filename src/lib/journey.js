export function factKey(target) {
  if (['map','outline'].includes(target.mode)) return `place:${target.datasetId}:${target.regionId}`;
  return target.baseId || target.id.replace(/:recognition$/, '');
}
export function learningStage(target) {
  if (target.learningStage) return target.learningStage;
  if (target.mode === 'timeline' || ['before-after','connections'].includes(target.kind)) return 'connections';
  if (/^-?\d{3,4}$/.test(String(target.answer)) || target.answerFormat === 'explanation' || String(target.answer).length > 70) return 'details';
  return 'foundation';
}
export function uniqueFacts(rows, targetOf = row => row) {
  const seen = new Set();
  return rows.filter(row => { const key = factKey(targetOf(row)); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function quizProgress(targets, reviews) {
  const byId = new Map(targets.map(t => [t.id,t]));
  const facts = uniqueFacts(targets);
  const latest = new Map();
  for (const review of [...reviews].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))) {
    const target=byId.get(review.targetId);
    if(target) latest.set(factKey(target),review);
  }
  const answered = facts.filter(t=>latest.has(factKey(t)));
  const correct = answered.filter(t=>{const r=latest.get(factKey(t));return r.correct===true && !r.usedHint && !r.learnedFirst;});
  return {total:facts.length,answered:answered.length,correct:correct.length,remaining:facts.length-answered.length};
}
export function overviewBounds(dataset, zoom=1, panX=0, panY=0) {
  const [x,y,w,h]=dataset.viewBox.split(/\s+/).map(Number);
  const left=Math.max(x,Math.min(x+w-w/zoom,x+w/2+panX*w-w/zoom/2));
  const top=Math.max(y,Math.min(y+h-h/zoom,y+h/2+panY*h-h/zoom/2));
  return `${left} ${top} ${w/zoom} ${h/zoom}`;
}
// Geography questions can expose each other's answer even when their target IDs differ.
export function exposureKey(target) {
  if (target.answer && (['map','outline'].includes(target.mode) || target.collectionIds?.some(id=>['norway','world-geography','european-capitals','geography-connections'].includes(id)))) {
    return `geography:${String(target.answer).normalize('NFKC').toLocaleLowerCase('nb').trim()}`;
  }
  return factKey(target);
}
export function uniqueQuizFacts(rows, targetOf=row=>row) {
  const seen=new Set();
  return rows.filter(row=>{const key=exposureKey(targetOf(row));if(seen.has(key))return false;seen.add(key);return true;});
}

export function effectiveRating(requested, {correct,learnedFirst,usedHint,mode}) {
  if (correct===false) return 1;
  if (learnedFirst) return correct===true ? Math.min(requested,2) : 1;
  return usedHint ? Math.min(requested,2) : requested;
}

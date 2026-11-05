import {factKey} from './journey.js';
export function sessionOutcome(attempts) {
  const results=[...new Map(attempts.filter(r=>!r.lesson).map((r,i)=>[r.id ?? i,r])).values()];
  const independent=results.filter(r=>r.correct===true && !r.usedHint && !r.learnedFirst).length;
  const supported=results.filter(r=>r.usedHint || r.learnedFirst).length;
  return {independent,supported,retry:results.length-independent-supported};
}
export function progressDetails(targets,reviews,now=new Date()) {
  const byId=new Map(targets.map(t=>[t.id,t]));
  const latest=new Map();
  for(const r of [...reviews].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))){const t=byId.get(r.targetId);if(t)latest.set(factKey(t),r);}
  const retryIds=[...latest.values()].filter(r=>r.correct!==true || r.usedHint || r.learnedFirst).map(r=>r.targetId);
  const key=d=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-6+i);return {label:d.toLocaleDateString('nb-NO',{weekday:'short'}),count:reviews.filter(r=>key(new Date(r.timestamp))===key(d)).length};});
  return {retryIds,days};
}

/** Typed answers the learner approved although the grader rejected them, newest first: candidates for new accepted answers. */
export function selfApprovals(targets,reviews,limit=20) {
  const byId=new Map(targets.map(t=>[t.id,t]));
  return reviews.filter(r=>r.selfApproved).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,limit)
    .map(r=>({targetId:r.targetId,prompt:byId.get(r.targetId)?.prompt ?? '',expected:byId.get(r.targetId)?.answer ?? '',typed:r.typedAnswer ?? ''}));
}

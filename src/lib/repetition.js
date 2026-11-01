export const MAX_SESSION_RETRIES=2;
export function needsRetry(result) {
  return result.rating===1 || result.correct!==true || Boolean(result.usedHint || result.learnedFirst);
}
export function advanceSession(session,result) {
  const queue=[...session.queue];
  const entry=queue[session.index];
  const attempts=queue.slice(0,session.index+1).filter(q=>q.id===entry.id).length;
  if(needsRetry(result) && attempts<=MAX_SESSION_RETRIES && !queue.slice(session.index+1).some(q=>q.id===entry.id)) {
    queue.push({id:entry.id,reason:'Session retry',sessionRetry:true});
  }
  const index=session.index+1;
  return {...session,queue,index,draft:null,results:[...session.results,{...result,sessionRetry:Boolean(entry.sessionRetry)}],status:index>=queue.length?'completed':'active'};
}
export function nextActionNote(session,result) {
  if(!needsRetry(result))return '';
  const entry=session.queue[session.index];
  const attempts=session.queue.slice(0,session.index+1).filter(q=>q.id===entry.id).length;
  return attempts<=MAX_SESSION_RETRIES?'Nytt forsøk mot slutten av quizen':'Øv videre i neste quiz';
}

export function retryTargets(results) {return [...new Map(results.filter(r=>!r.lesson).map(r=>[r.id,r])).values()].filter(needsRetry).map(r=>r.id);}

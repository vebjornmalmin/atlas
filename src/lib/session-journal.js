const KEY='atlas-session-journal';
export function saveJournal(storage, session, draft, screen, view, detailId='') {
  storage.setItem(KEY, JSON.stringify({sessionId:session?.sessionId,index:session?.index,draft,screen,view,detailId}));
}
export function readJournal(storage, session) {
  try {
    const saved=JSON.parse(storage.getItem(KEY));
    if(!saved || saved.sessionId!==session?.sessionId || saved.index!==session?.index) return null;
    return saved;
  } catch { return null; }
}
/**
 * Drops the entries still ahead in a saved session whose card or unit no longer exists, so a session
 * started before a content update carries on instead of stopping at a retired question. Answers
 * already given are left alone.
 */
export function dropRetired(session, exists) {
  if (!session || session.status !== 'active' || !Array.isArray(session.queue)) return session;
  const ahead = session.queue.slice(session.index);
  const kept = ahead.filter(exists);
  if (kept.length === ahead.length) return session;
  return {...session, queue: [...session.queue.slice(0, session.index), ...kept], draft: ahead[0] === kept[0] ? session.draft : null, status: kept.length ? 'active' : 'completed'};
}
export function questionDraft(targetId, values) { return JSON.parse(JSON.stringify({targetId,...values})); }
export function restoreDraft(target, draft) {
  return target && draft?.targetId===target.id ? draft : null;
}

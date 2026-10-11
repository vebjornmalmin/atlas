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
export function questionDraft(targetId, values) { return JSON.parse(JSON.stringify({targetId,...values})); }
export function restoreDraft(target, draft) {
  return target && draft?.targetId===target.id ? draft : null;
}

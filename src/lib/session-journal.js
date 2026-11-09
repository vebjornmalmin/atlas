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

// Unfinished sessions are kept so the learner can move between quizzes and pick each one up again.
export const DAILY_TITLE = 'Dagens økt';
export const OPEN_SESSION_DAYS = 30;
export const isDaily = session => session?.title === DAILY_TITLE;
export const lastActivity = session => session?.updatedAt || session?.startedAt || '';
const dayKey = value => { const d = new Date(value); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
export const sameDay = (a, b) => dayKey(a) === dayKey(b);

/**
 * Every session that can be continued: the active one and those set aside when another quiz was started.
 * The active copy wins over its archived copy. A daily session belongs to its own day; after that its due
 * cards and unfinished topics return in the new day's plan. Other quizzes stay for {@link OPEN_SESSION_DAYS}.
 * Newest activity first.
 */
export function openSessions(active, saved = [], {now = new Date(), exists = () => true} = {}) {
  const byId = new Map();
  for (const item of [...saved.filter(s => s?.id !== 'active'), active]) if (item?.sessionId) byId.set(item.sessionId, item);
  return [...byId.values()]
    .filter(s => s.status === 'active' && Array.isArray(s.queue) && s.index < s.queue.length)
    .filter(s => isDaily(s) ? sameDay(s.startedAt, now) : now - new Date(lastActivity(s)) < OPEN_SESSION_DAYS * 86400000)
    .filter(s => s.queue.slice(s.index).some(exists))
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}

/** «3 av 14 gjort»: the same count on every card, in the session and in the list of open quizzes. */
export const doneLabel = session => `${session.index} av ${session.queue.length} gjort`;

/** Whether a daily session was finished today; a further daily session that day is optional extra. */
export function dailyDoneToday(active, saved = [], now = new Date()) {
  return [active, ...saved].some(s => s && isDaily(s) && s.status === 'completed' && sameDay(s.completedAt || s.updatedAt || s.startedAt, now));
}

/**
 * What is left in a session, so the start page can say what it holds instead of only a count.
 * `answeredToday` holds cards answered today in other sessions; `repeats` counts those still ahead.
 */
export function sessionMix(session, {perspectiveReason = '', answeredToday = new Set()} = {}) {
  const mix = {review: 0, fresh: 0, perspective: 0, retry: 0, lesson: 0, repeats: 0};
  for (const entry of session?.queue?.slice(session.index) || []) {
    if (typeof entry.id === 'string' && entry.id.startsWith('lesson:')) { mix.lesson++; continue; }
    if (entry.sessionRetry) { mix.retry++; continue; }
    if (entry.reason === 'Due review') mix.review++;
    else if (perspectiveReason && entry.reason === perspectiveReason) mix.perspective++;
    else mix.fresh++;
    if (answeredToday.has(entry.id)) mix.repeats++;
  }
  return mix;
}

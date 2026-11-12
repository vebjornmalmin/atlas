// Pure reducer for quiz-off: the whole game state is computed from the numbered event log.
export const BASE_POINTS = 100, SPEED_POINTS = 50;
// An open question's winners get what a perfect answer to any other question can give.
export const WIN_POINTS = BASE_POINTS + SPEED_POINTS;

const firstActive = players => (players.find(p => !p.left) || {}).id || null;

export function initialGame(room, you) {
  return {code: room && room.code || '', you, seq: 0, gap: false, phase: 'lobby', players: [], host: null,
    settings: null, questions: [], q: -1, openedAt: null, deadline: null, ballot: null, rounds: [], scores: {}};
}

// FNV-1a with a final mix, so ids that differ in one character land far apart: the ballot order is the same on every
// phone and not the order of the player list.
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  return (h ^ h >>> 16) >>> 0;
}
export function ballotOrder(event) {
  const ids = Object.keys(event.answers || {});
  const key = id => hash(`${event.q}:${event.at}:${id}`);
  return ids.sort((a, b) => key(a) - key(b) || (a < b ? -1 : a > b ? 1 : 0));
}

// Votes per answer, counting only votes for another player's answer on the ballot.
export function tally(answers, votes) {
  const counts = Object.fromEntries(Object.keys(answers || {}).map(id => [id, 0]));
  for (const [voter, target] of Object.entries(votes || {})) if (voter !== target && Object.hasOwn(counts, target)) counts[target]++;
  return counts;
}
// The answer or answers with the most votes, when that is at least one; a lone answer wins without a vote.
export function winners(answers, votes) {
  const counts = tally(answers, votes), ids = Object.keys(counts);
  if (ids.length === 1) return ids;
  const top = Math.max(0, ...Object.values(counts));
  return top ? ids.filter(id => counts[id] === top) : [];
}

export function points(seconds, ms, correct) {
  if (!correct) return 0;
  const total = seconds * 1000;
  const t = total > 0 ? Math.min(Math.max(ms, 0), total) : 0;
  return BASE_POINTS + Math.round(SPEED_POINTS * (total > 0 ? 1 - t / total : 0));
}

export function applyEvent(game, event, grade) {
  if (!event || !Number.isInteger(event.seq)) return game;
  if (event.seq <= game.seq) return game;
  if (event.seq > game.seq + 1) return game.gap ? game : {...game, gap: true};
  const g = {...game, seq: event.seq, gap: false};
  switch (event.type || event.t) {
    case 'joined': {
      const p = event.player;
      if (!p || game.players.some(x => x.id === p.id)) return g;
      g.players = [...game.players, {id: p.id, name: p.name, left: false}];
      g.scores = {...game.scores, [p.id]: {points: 0, correct: 0, ms: 0}};
      g.host = firstActive(g.players);
      return g;
    }
    case 'left': {
      const id = event.player && typeof event.player === 'object' ? event.player.id : event.player;
      g.players = game.players.map(p => p.id === id ? {...p, left: true} : p);
      g.host = firstActive(g.players);
      return g;
    }
    case 'started':
      g.settings = event.settings;
      g.questions = event.questions || [];
      return g;
    case 'question':
      g.phase = 'question';
      g.q = event.q;
      g.openedAt = event.at;
      g.deadline = event.deadline;
      g.ballot = null;
      return g;
    case 'ballot':
      g.phase = 'vote';
      g.q = event.q;
      g.deadline = event.deadline;
      g.ballot = {q: event.q, at: event.at, deadline: event.deadline, answers: event.answers || {}, order: ballotOrder(event)};
      return g;
    case 'reveal': {
      const entry = game.questions[event.q];
      if (entry && entry.mode === 'open') return revealOpen(game, g, event);
      const seconds = game.settings ? game.settings.seconds : 0;
      const answers = {}, scores = {...game.scores};
      for (const id of Object.keys(event.answers || {})) {
        const {answer, ms} = event.answers[id];
        const correct = !!entry && grade(entry, answer) === true;
        const pts = points(seconds, ms, correct);
        answers[id] = {answer, ms, correct, points: pts};
        const s = scores[id] || {points: 0, correct: 0, ms: 0};
        scores[id] = correct ? {points: s.points + pts, correct: s.correct + 1, ms: s.ms + ms} : s;
      }
      g.scores = scores;
      g.rounds = [...game.rounds.filter(r => r.q !== event.q), {q: event.q, answers}];
      g.phase = 'reveal';
      return g;
    }
    case 'finished':
      g.phase = 'finished';
      return g;
    default:
      return g;
  }
}

// No grading and no speed bonus: the winners of the vote get WIN_POINTS and count as right. Their time is left out of
// the tie-break, which is about speed.
function revealOpen(game, g, event) {
  const given = event.answers || {}, votes = event.votes || {};
  const counts = tally(given, votes), won = new Set(winners(given, votes));
  const answers = {}, scores = {...game.scores};
  for (const id of Object.keys(given)) {
    const {answer, ms} = given[id], correct = won.has(id), pts = correct ? WIN_POINTS : 0;
    answers[id] = {answer, ms, correct, points: pts, votes: counts[id]};
    const s = scores[id] || {points: 0, correct: 0, ms: 0};
    if (correct) scores[id] = {points: s.points + pts, correct: s.correct + 1, ms: s.ms};
  }
  g.scores = scores;
  g.rounds = [...game.rounds.filter(r => r.q !== event.q), {q: event.q, answers, votes: {...votes}, open: true}];
  g.phase = 'reveal';
  return g;
}

export function replay(room, you, events, grade) {
  const bySeq = new Map();
  for (const e of events || []) if (e && Number.isInteger(e.seq) && !bySeq.has(e.seq)) bySeq.set(e.seq, e);
  let game = initialGame(room, you);
  for (const seq of [...bySeq.keys()].sort((a, b) => a - b)) game = applyEvent(game, bySeq.get(seq), grade);
  return game;
}

export function scoreboard(game) {
  const rows = game.players.map(p => {
    const s = game.scores[p.id] || {points: 0, correct: 0, ms: 0};
    return {id: p.id, name: p.name, points: s.points, correct: s.correct, ms: s.ms, left: p.left, rank: 0};
  });
  rows.sort((a, b) => b.points - a.points || a.ms - b.ms || a.name.localeCompare(b.name, 'nb') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.points === r.points && prev.ms === r.ms ? prev.rank : i + 1;
  });
  return rows;
}

export const activePlayers = game => game.players.filter(p => !p.left);
export const currentQuestion = game => game.questions[game.q] || null;
export const roundFor = (game, q) => game.rounds.find(r => r.q === q) || null;
export const isHost = (game, id) => game.host !== null && game.host === id;

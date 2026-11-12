// Quiz-off wire protocol shared by the room (Worker) and the phones. Pure, no platform APIs.
export const PROTOCOL = 1;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;
export const MAX_PLAYERS = 8, MIN_PLAYERS = 2;
export const NAME_MAX = 20, ANSWER_MAX = 200, OPEN_ANSWER_MAX = 400, TITLE_MAX = 60, QUESTION_ID_MAX = 200;
export const COUNT_MIN = 3, COUNT_MAX = 20, SECONDS_MIN = 10, SECONDS_MAX = 60;
// 'open': an explain-why question, decided by the players' vote instead of grading.
export const MODES = ['recognition', 'recall', 'open'];
// Fixed lengths: an open question and its vote, whatever the host chose; the reveal before the game moves on by itself.
export const OPEN_SECONDS = 60, VOTE_SECONDS = 30, REVEAL_SECONDS = 20;
export const MESSAGE_MAX = 16384;
export const ID_MAX = 64, KEY_MIN = 16, KEY_MAX = 128, VERSION_MAX = 100;
export const TIMEUP_TOLERANCE = 250, FORCE_AFTER = REVEAL_SECONDS * 1000;
export const ROOM_TTL = 6 * 3600e3, FINISHED_TTL = 30 * 60e3, ACTIVE_WINDOW = 3600e3;
export const PING = 'ping', PONG = 'pong';
export const ERROR = {noRoom:'no-room', version:'version', full:'full', started:'started', name:'name', key:'key', bad:'bad'};
// The client stops reconnecting on these.
export const FATAL = ['no-room', 'version', 'full', 'started', 'name', 'key'];
export const CLOSE = {normal:1000, replaced:4000, error:4001};

export function makeRoomCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.min(CODE_ALPHABET.length - 1, Math.floor(random() * CODE_ALPHABET.length))];
  return code;
}
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
export const isRoomCode = code => typeof code === 'string' && CODE_RE.test(code);

// Trimmed, single-spaced, no control characters; '' when not 1–20 characters.
export function cleanName(name) {
  if (typeof name !== 'string') return '';
  const s = name.normalize('NFC').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim();
  const n = [...s].length;
  return n >= 1 && n <= NAME_MAX ? s : '';
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max;
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
export const isVersion = v => isStr(v, 1, VERSION_MAX);
export const isPlayerId = v => isStr(v, 1, ID_MAX) && /^[A-Za-z0-9_-]+$/.test(v);
const isQ = q => isInt(q, 0, COUNT_MAX - 1);

// Each check returns a normalized copy of a well-formed message, or null.
// hello keeps any integer v and any string name so the room can answer 'version' or 'name' instead of 'bad'.
export function checkHello(m) {
  if (!isObj(m) || m.t !== 'hello' || !Number.isInteger(m.v) || !isObj(m.player)) return null;
  const {id, name} = m.player;
  if (!isPlayerId(id) || typeof name !== 'string' || name.length > 200) return null;
  if (!isStr(m.key, KEY_MIN, KEY_MAX) || !isVersion(m.app) || !isVersion(m.pack)) return null;
  const have = m.have ?? 0;
  if (!isInt(have, 0, Number.MAX_SAFE_INTEGER)) return null;
  return {t:'hello', v:m.v, player:{id, name}, key:m.key, app:m.app, pack:m.pack, have};
}
export function checkSettings(s) {
  if (!isObj(s) || !isInt(s.count, COUNT_MIN, COUNT_MAX) || !isInt(s.seconds, SECONDS_MIN, SECONDS_MAX)) return null;
  const title = s.title ?? '';
  if (!isStr(title, 0, TITLE_MAX)) return null;
  return {count:s.count, seconds:s.seconds, title};
}
export function checkStart(m) {
  if (!isObj(m) || m.t !== 'start' || !Array.isArray(m.questions)) return null;
  const settings = checkSettings(m.settings);
  if (!settings || m.questions.length !== settings.count) return null;
  const questions = [];
  for (const q of m.questions) {
    if (!isObj(q) || !isStr(q.id, 1, QUESTION_ID_MAX) || !MODES.includes(q.mode)) return null;
    questions.push({id:q.id, mode:q.mode});
  }
  return {t:'start', settings, questions};
}
// Up to OPEN_ANSWER_MAX here; the room holds answers to other questions to ANSWER_MAX, since only it knows the mode.
export function checkAnswer(m) {
  if (!isObj(m) || m.t !== 'answer' || !isQ(m.q) || !isStr(m.answer, 1, OPEN_ANSWER_MAX) || !m.answer.trim()) return null;
  return {t:'answer', q:m.q, answer:m.answer};
}
export function checkVote(m) {
  if (!isObj(m) || m.t !== 'vote' || !isQ(m.q) || !isPlayerId(m.for)) return null;
  return {t:'vote', q:m.q, for:m.for};
}
const roundCheck = t => m => isObj(m) && m.t === t && isQ(m.q) ? {t, q:m.q} : null;
export const checkTimeup = roundCheck('timeup'), checkReady = roundCheck('ready'), checkForce = roundCheck('force');
export const checkLeave = m => isObj(m) && m.t === 'leave' ? {t:'leave'} : null;

const CHECKS = {hello:checkHello, start:checkStart, answer:checkAnswer, vote:checkVote, timeup:checkTimeup, ready:checkReady, force:checkForce, leave:checkLeave};
export const checkMessage = m => isObj(m) && Object.hasOwn(CHECKS, m.t) ? CHECKS[m.t](m) : null;

const encoder = new TextEncoder();
// A text frame as an object, or null when it is not a JSON object within MESSAGE_MAX bytes.
export function parseMessage(data) {
  if (typeof data !== 'string' || data.length > MESSAGE_MAX || encoder.encode(data).length > MESSAGE_MAX) return null;
  try { const m = JSON.parse(data); return isObj(m) ? m : null; } catch { return null; }
}

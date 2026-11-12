// Quiz-off join links: the app's own address with ?quizoff=CODE. The link carries only the code. Pure, no platform APIs.
import {isRoomCode} from './protocol.js';

export const INVITE_PARAM = 'quizoff';

export const inviteUrl = (origin, code) => `${String(origin || '').replace(/\/+$/, '')}/?${INVITE_PARAM}=${encodeURIComponent(code)}`;

// The valid upper-case code in a URL, a search string ("?quizoff=abcd") or a bare query; '' otherwise. Never throws.
export function codeFromUrl(urlOrSearch) {
  try {
    const s = String(urlOrSearch ?? '');
    const q = s.indexOf('?');
    const query = (q >= 0 ? s.slice(q + 1) : s).split('#')[0];
    const value = new URLSearchParams(query).get(INVITE_PARAM);
    // Tolerates spaces and punctuation around the letters (a link pasted from a message), not other letters.
    const code = String(value ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    return isRoomCode(code) ? code : '';
  } catch {
    return '';
  }
}

// Search string without the invite parameter, so a reload does not join again. '' when nothing is left.
export function withoutInvite(search) {
  try {
    const params = new URLSearchParams(String(search ?? ''));
    params.delete(INVITE_PARAM);
    const rest = params.toString();
    return rest ? `?${rest}` : '';
  } catch {
    return '';
  }
}

// The share sheet text; the code is in it too, for someone who opens the installed app and types it.
export const inviteText = code => `Bli med på quiz-off i Atlas! Trykk på lenken, eller åpne Atlas, trykk «Quiz-off» på I dag og skriv koden ${code}.`;

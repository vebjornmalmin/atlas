// Worker entry. Only /api/* reaches this code (run_worker_first); everything else is served as static assets.
import {CLOSE, isVersion, isRoomCode, makeRoomCode} from '../src/lib/quizoff/protocol.js';
export {QuizRoom} from './quiz-room.js';

const ATTEMPTS = 5;
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'}});
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const room = (env, code) => env.QUIZ_ROOM.get(env.QUIZ_ROOM.idFromName(code));
const crossOrigin = (request, url) => {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).host !== url.host; } catch { return true; }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/quizoff/rooms') {
      if (request.method !== 'POST') return json({error:'method'}, 405);
      if (crossOrigin(request, url)) return json({error:'origin'}, 403);
      let body;
      try { body = await request.json(); } catch { return json({error:'bad'}, 400); }
      if (!isVersion(body?.app) || !isVersion(body?.pack)) return json({error:'bad'}, 400);
      for (let i = 0; i < ATTEMPTS; i++) {
        const code = makeRoomCode(random);
        const res = await room(env, code).fetch('https://room/init', {method:'POST', body:JSON.stringify({code, app:body.app, pack:body.pack})});
        if (res.status === 201) return json({code}, 201);
        if (res.status !== 409) return json({error:'room'}, 500);
      }
      return json({error:'busy'}, 503);
    }
    const match = url.pathname.match(/^\/api\/quizoff\/rooms\/([^/]+)\/ws$/);
    if (match) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({error:'upgrade'}, 426);
      if (crossOrigin(request, url)) return json({error:'origin'}, 403);
      const code = match[1].toUpperCase();
      if (isRoomCode(code)) return room(env, code).fetch(new Request('https://room/ws', request));
      // Not a code any room can have: answer like a missing room.
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      server.send(JSON.stringify({t:'error', code:'no-room'}));
      server.close(CLOSE.error, 'no-room');
      return new Response(null, {status:101, webSocket:client});
    }
    return json({error:'not-found'}, 404);
  },
};

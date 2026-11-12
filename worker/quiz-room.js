// One quiz-off room. A thin shell: room-core decides, this stores, sends and closes.
// Durable state is one storage key ('room'), so each decision costs at most one row write.
// Per-socket player id and ready flag live in the socket attachment and survive hibernation.
import {DurableObject} from 'cloudflare:workers';
import {CLOSE, PING, PONG, ROOM_TTL, isRoomCode, isVersion, parseMessage} from '../src/lib/quizoff/protocol.js';
import {alarm, createRoom, handle} from './room-core.js';

const KEY = 'room';

export class QuizRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.seen = 0;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get(KEY)) ?? null; });
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/init' && request.method === 'POST') {
      const {code, app, pack} = await request.json();
      if (!isRoomCode(code) || !isVersion(app) || !isVersion(pack)) return new Response(null, {status:400});
      if (this.room) return new Response(null, {status:409});
      const now = Date.now();
      this.room = createRoom({code, app, pack, now});
      await this.ctx.storage.put(KEY, this.room);
      await this.ctx.storage.setAlarm(now + ROOM_TTL);
      return new Response(null, {status:201});
    }
    if (path === '/ws' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({sid:crypto.randomUUID(), id:null, ready:-1});
      return new Response(null, {status:101, webSocket:client});
    }
    return new Response(null, {status:404});
  }

  async webSocketMessage(ws, data) {
    const a = ws.deserializeAttachment();
    if (!a || a.closed) return;
    await this.run({kind:'message', sid:a.sid, msg:parseMessage(data), now:Date.now()});
  }
  async webSocketClose(ws) { await this.gone(ws); }
  async webSocketError(ws) { await this.gone(ws); }
  async gone(ws) {
    const a = ws.deserializeAttachment();
    if (!a || a.closed) return;
    await this.run({kind:'close', sid:a.sid, now:Date.now()}, ws);
    try { ws.serializeAttachment({...a, closed:true}); } catch {}
  }

  async alarm() {
    const r = alarm(this.room, Date.now(), this.seen);
    if (r.wipe) await this.wipe(); else await this.ctx.storage.setAlarm(r.alarm);
  }

  // Open sockets with their attachments; `extra` is a socket being closed that the runtime may no longer list.
  live(extra) {
    const list = this.ctx.getWebSockets().filter(ws => ws !== extra).map(ws => [ws, ws.deserializeAttachment()]);
    if (extra) list.push([extra, extra.deserializeAttachment()]);
    return list.filter(([, a]) => a && !a.closed);
  }

  async run(input, extra) {
    this.seen = input.now;
    const list = this.live(extra), bySid = new Map(list.map(([ws, a]) => [a.sid, [ws, a]]));
    const r = handle(this.room, list.map(([, a]) => ({sid:a.sid, id:a.id, ready:a.ready})), input);
    if (r.wipe) {
      for (const {to, msg} of r.send) send(bySid.get(to)?.[0], msg);
      return this.wipe();
    }
    this.room = r.room;
    if (r.persist) await this.ctx.storage.put(KEY, r.room);
    if (r.alarm) await this.ctx.storage.setAlarm(r.alarm);
    for (const s of r.sockets) {
      const [ws, a] = bySid.get(s.sid) ?? [];
      if (ws && (a.id !== s.id || a.ready !== s.ready)) ws.serializeAttachment({sid:s.sid, id:s.id, ready:s.ready});
    }
    for (const {to, msg} of r.send) send(bySid.get(to)?.[0], msg);
    for (const {sid, code, reason} of r.close) {
      const [ws, a] = bySid.get(sid) ?? [];
      if (!ws) continue;
      try { ws.serializeAttachment({...a, closed:true}); ws.close(code, reason); } catch {}
    }
    // One in-memory retry at the deadline for a timeup or force that came slightly early.
    if (r.retryAt) {
      const {phase, round:{q}} = r.room;
      setTimeout(() => this.run({kind:'clock', phase, q, now:Date.now()}).catch(() => {}), Math.max(0, r.retryAt - Date.now()));
    }
  }

  // Deletes everything; phones still connected are told the room is gone.
  async wipe() {
    this.room = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    for (const [ws, a] of this.live()) {
      send(ws, {t:'error', code:'no-room'});
      try { ws.serializeAttachment({...a, closed:true}); ws.close(CLOSE.error, 'no-room'); } catch {}
    }
  }
}

function send(ws, msg) {
  if (!ws) return;
  try { ws.send(JSON.stringify(msg)); } catch {}
}

/* Immutable board projection and playback. Viewer state never enters a saved board. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PSPlayerEyeModel = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var RAD = Math.PI / 180;
  function finite(n, fallback) { return typeof n === 'number' && isFinite(n) ? n : fallback; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function id(o) { return String(o && o.id); }
  function valid(o) { return o && Number.isFinite(o.x) && Number.isFinite(o.y); }
  function angle(n) { return ((n + 180) % 360 + 360) % 360 - 180; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function curve(a, b, offset, t) {
    var mx = finite(offset && offset.mx, 0), my = finite(offset && offset.my, 0);
    return { x: mix(a.x, b.x, t) + 4 * (1 - t) * t * mx, y: mix(a.y, b.y, t) + 4 * (1 - t) * t * my };
  }
  function point(p, field) { return { x: (p.x - field.cx) / field.units, z: (p.y - field.cy) / field.units }; }
  function direction(p) {
    if (Number.isFinite(p.dir)) return angle(p.dir);
    return /^(red|green|away)$/.test(p.team) ? 180 : 0;
  }
  function nearestBall(snap, player) {
    if (valid(snap.ball)) return snap.ball;
    return (snap.equipment || []).filter(function (p) { return p.team === 'ball' && valid(p); }).reduce(function (best, p) {
      return !best || Math.hypot(p.x - player.x, p.y - player.y) < Math.hypot(best.x - player.x, best.y - player.y) ? p : best;
    }, null);
  }
  function color(p, snap, fallback) {
    var gk = !p.coach && (p.pos === 'GK' || String(p.num) === '1');
    var c = p.color || (gk && snap.gkColors && snap.gkColors[p.team]) || (snap.teamColors && snap.teamColors[p.team]) || fallback[p.team];
    return typeof c === 'string' && /^#[a-f\d]{3,8}$/i.test(c) ? c : '#284b80';
  }
  function interpolate(a, b, u, curves, ballProgress) {
    a = a || {}; b = b || {}; curves = curves || {};
    if (u >= 1) return copy(b);
    var out = Object.assign({}, a);
    function list(key) {
      var dest = new Map((b[key] || []).map(function (p) { return [id(p), p]; }));
      var result = (a[key] || []).map(function (p) {
        var q = dest.get(id(p)) || p, pt = curve(p, q, curves[p.id], u);
        var item = Object.assign({}, p, pt);
        // Preserve the recorded body orientation; head rotation is an independent UI value.
        item.dir = direction(p) + angle(direction(q) - direction(p)) * u;
        item.eyeDirectionExplicit = Number.isFinite(p.dir);
        if (p.team === 'ball') item.eyeAir = curves[p.id] && curves[p.id].air ? Math.sin(Math.PI * u) * clamp(+curves[p.id].air || 1, 1, 3) : 0;
        dest.delete(id(p)); return item;
      });
      dest.forEach(function (p) { result.push(Object.assign({}, p)); });
      return result;
    }
    out.players = list('players'); out.equipment = list('equipment');
    if (a.ball || b.ball) {
      var ba = a.ball || b.ball, bb = b.ball || a.ball;
      var bu = ballProgress ? clamp(ballProgress(a, b, u, curves), 0, 1) : u;
      out.ball = Object.assign({}, ba, curve(ba, bb, curves.ball, bu), { eyeAir: curves.ball && curves.ball.air ? Math.sin(Math.PI * u) * clamp(+curves.ball.air || 1, 1, 3) : 0 });
    } else out.ball = null;
    return out;
  }
  function timeline(frames, hold) {
    var at = 0, h = Math.max(.1, +hold || .6), starts = [], segments = [];
    frames.forEach(function (f, i) {
      starts.push(at); segments.push({ from: i, to: i, start: at, duration: h }); at += h;
      if (i < frames.length - 1) {
        var duration = Math.max(.3, +f.dur || 1) / (+f.moveSpeed > 0 ? +f.moveSpeed : 1);
        segments.push({ from: i, to: i + 1, start: at, duration: duration }); at += duration;
      }
    });
    return { starts: starts, segments: segments, total: at };
  }
  function session(source) {
    var snap = copy(source.snap || {}), frames = copy((source.frames || []).filter(function (f) { return f && f.snap; }));
    var active = clamp(Math.floor(finite(source.active, -1)), -1, frames.length - 1);
    // The active draft is copied into this session only. Do not stamp live data into anim.frames.
    if (source.inAnimation && active >= 0) frames[active].snap = snap;
    var plan = timeline(frames, source.hold);
    return { snap: snap, frames: frames, field: copy(source.field), colors: copy(source.colors || {}), plan: plan,
      start: source.inAnimation && active >= 0 ? plan.starts[active] : 0, currentOnly: !source.inAnimation || frames.length < 2 };
  }
  function sample(s, seconds, currentOnly, ballProgress) {
    if (currentOnly || !s.frames.length) return { snap: s.snap, index: -1, moving: false };
    var t = clamp(finite(seconds, 0), 0, s.plan.total);
    var seg = s.plan.segments.find(function (p) { return t < p.start + p.duration; }) || s.plan.segments[s.plan.segments.length - 1];
    if (!seg) return { snap: s.snap, index: -1, moving: false };
    var f = s.frames[seg.from], b = s.frames[seg.to];
    var u = seg.from === seg.to ? 0 : ease(clamp((t - seg.start) / seg.duration, 0, 1));
    return { snap: seg.from === seg.to ? f.snap : interpolate(f.snap, b.snap, u, f.curves, ballProgress), index: seg.from, moving: seg.from !== seg.to };
  }
  function project(sampled, s) {
    var snap = sampled.snap, field = s.field;
    var players = (snap.players || []).filter(function (p) { return valid(p) && !p.coach; }).map(function (p) {
      return Object.assign({}, p, point(p, field), { key: id(p), boardX: p.x, boardY: p.y, body: direction(p),
        explicit: p.eyeDirectionExplicit !== undefined ? p.eyeDirectionExplicit : Number.isFinite(p.dir), color: color(p, snap, s.colors) });
    });
    var equipment = (snap.equipment || []).filter(valid).map(function (p) { return Object.assign({}, p, point(p, field), { key: 'e:' + id(p) }); });
    var ball = valid(snap.ball) ? Object.assign({}, snap.ball, point(snap.ball, field), { key: 'ball' }) : null;
    return { players: players, equipment: equipment, ball: ball, drawings: snap.drawings || [], snap: snap, index: sampled.index, moving: sampled.moving, field: field };
  }
  function camera(player, head, pitch, height, ball, tracking) {
    if (!player) return null;
    var body = player.body * RAD, yaw = body + head * RAD, tilt = pitch * RAD;
    var distance = ball && Math.hypot(ball.x - player.x, ball.z - player.z);
    if (tracking && distance > .15) {
      yaw = Math.atan2(ball.z - player.z, ball.x - player.x);
      tilt = clamp(Math.atan2(finite(ball.eyeAir, 0) + .115 - height, distance), -40 * RAD, 25 * RAD);
    }
    return { x: player.x, y: height, z: player.z, yaw: yaw, body: body, pitch: tilt, head: angle(yaw / RAD - player.body) };
  }
  return { clamp: clamp, copy: copy, angle: angle, curve: curve, point: point, direction: direction, nearestBall: nearestBall,
    interpolate: interpolate, timeline: timeline, session: session, sample: sample, project: project, camera: camera };
});

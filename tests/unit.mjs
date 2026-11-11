// Run: npm test   (Node 22+, no dependencies)
import assert from 'node:assert/strict';
import { SyncEngine } from '../src/syncCore.ts';
import { appliesTo, buildSections, progress, shiftDate, statusOn, withStatus } from '../src/taskUtils.ts';

const T0 = Date.now() - 24 * 3600 * 1000; // records are "yesterday"; deletes use the real clock
const at = (min) => new Date(T0 + min * 60000).toISOString();
const clone = (x) => structuredClone(x);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('  ok  ' + name); };

function server() {
  const rows = new Map(); let tick = 0; const log = [];
  return {
    rows, log,
    remote: () => ({
      async pull(since) { return [...rows.values()].filter((r) => Date.parse(r.synced_at) > Date.parse(since)).map(clone); },
      async push(batch) { log.push(batch.length); for (const r of batch) rows.set(r.kind + ':' + r.id, { ...clone(r), synced_at: new Date(T0 + 1e9 + ++tick * 3600000).toISOString() }); },
    }),
  };
}
function device() {
  const kv = new Map();
  const engine = new SyncEngine({ getItem: (k) => (kv.has(k) ? kv.get(k) : null), setItem: (k, v) => void kv.set(k, v) });
  const data = { journal: new Map(), task: new Map() };
  for (const kind of ['journal', 'task']) engine.register(kind, {
    all: async () => [...data[kind].values()].map(clone),
    put: async (items) => items.forEach((i) => data[kind].set(i.id, clone(i))),
    del: async (id) => void data[kind].delete(id),
  });
  return {
    engine, data,
    save(kind, item) { data[kind].set(item.id, clone(item)); engine.markSaved(kind, item.id); },
    remove(kind, id) { data[kind].delete(id); engine.markRemoved(kind, id); },
    sync: (srv, uid = 'u1') => engine.run(srv.remote(), uid),
  };
}
const task = (id, over = {}) => ({ id, title: id, notes: '', date: '2030-06-01', time: '', endTime: '', group: '', pinned: false, status: 'todo', log: {}, createdAt: at(0), updatedAt: at(1), ...over });
const jr = (date, text, min) => ({ id: date, date, rating: 3, dayText: text, feelings: '', story: '', forgiveness: '', createdAt: at(0), updatedAt: at(min) });

console.log('sync engine');
await test('data created before first login is uploaded; a new device receives it', async () => {
  const s = server(), A = device(), B = device();
  A.save('journal', jr('2030-06-01', 'hello', 1)); A.save('task', task('t1'));
  await A.sync(s);
  assert.equal(s.rows.size, 2);
  const changed = await B.sync(s);
  assert.equal(changed, 2);
  assert.equal(B.data.journal.get('2030-06-01').dayText, 'hello');
  assert.ok(B.data.task.has('t1'));
});
await test('a second sync with nothing new changes and pushes nothing', async () => {
  const s = server(), A = device();
  A.save('task', task('t1')); await A.sync(s);
  const pushes = s.log.length;
  assert.equal(await A.sync(s), 0);
  assert.equal(s.log.length, pushes);
  assert.equal(A.engine.hasPending(), false);
});
await test('edits on two devices converge (different records)', async () => {
  const s = server(), A = device(), B = device();
  A.save('task', task('a')); A.save('task', task('b')); await A.sync(s); await B.sync(s);
  A.save('task', task('a', { title: 'A edited', updatedAt: at(10) }));
  B.save('task', task('b', { title: 'B edited', updatedAt: at(11) }));
  await A.sync(s); await B.sync(s); await A.sync(s);
  for (const d of [A, B]) { assert.equal(d.data.task.get('a').title, 'A edited'); assert.equal(d.data.task.get('b').title, 'B edited'); }
});
await test('same record edited on both devices: latest edit wins everywhere', async () => {
  const s = server(), A = device(), B = device();
  A.save('task', task('x')); await A.sync(s); await B.sync(s);
  A.save('task', task('x', { title: 'older', updatedAt: at(20) }));
  B.save('task', task('x', { title: 'newer', updatedAt: at(30) }));
  await B.sync(s); await A.sync(s); await B.sync(s);
  assert.equal(A.data.task.get('x').title, 'newer');
  assert.equal(B.data.task.get('x').title, 'newer');
});
await test('a delete reaches other devices', async () => {
  const s = server(), A = device(), B = device();
  A.save('journal', jr('2030-06-02', 'bye', 1)); A.save('task', task('t')); await A.sync(s); await B.sync(s);
  A.remove('journal', '2030-06-02'); A.remove('task', 't');
  await A.sync(s); await B.sync(s);
  assert.equal(B.data.journal.size, 0); assert.equal(B.data.task.size, 0);
  assert.equal(await B.sync(s), 0);
});
await test('delete on one device vs later edit on another: the edit survives', async () => {
  const s = server(), A = device(), B = device();
  A.save('task', task('k')); await A.sync(s); await B.sync(s);
  A.remove('task', 'k');
  B.save('task', task('k', { title: 'kept', updatedAt: new Date(Date.now() + 60000).toISOString() }));
  await A.sync(s); await B.sync(s); await A.sync(s);
  assert.equal(A.data.task.get('k')?.title, 'kept');
  assert.equal(B.data.task.get('k')?.title, 'kept');
});
await test('delete then re-create the same journal date', async () => {
  const s = server(), A = device(), B = device();
  A.save('journal', jr('2030-06-03', 'v1', 1)); await A.sync(s); await B.sync(s);
  A.remove('journal', '2030-06-03');
  A.save('journal', jr('2030-06-03', 'v2', 50));
  await A.sync(s); await B.sync(s);
  assert.equal(B.data.journal.get('2030-06-03').dayText, 'v2');
});
await test('offline work: many local changes are pushed together later', async () => {
  const s = server(), A = device(), B = device();
  for (let i = 0; i < 250; i++) A.save('task', task('t' + i, { updatedAt: at(i) }));
  await A.sync(s);
  assert.deepEqual(s.log, [100, 100, 50]);
  assert.equal(await B.sync(s), 250);
});
await test('an edit made while a sync is running is not lost', async () => {
  const s = server(), A = device();
  A.save('task', task('r', { updatedAt: at(1) })); await A.sync(s);
  A.save('task', task('r', { title: 'v2', updatedAt: at(2) }));
  const remote = s.remote();
  const slow = { pull: remote.pull, async push(b) { A.save('task', task('r', { title: 'v3', updatedAt: at(3) })); return remote.push(b); } };
  await A.engine.run(slow, 'u1');
  assert.equal(A.engine.hasPending(), true); // v3 still waiting
  await A.sync(s);
  assert.equal(s.rows.get('task:r').data.title, 'v3');
  assert.equal(A.engine.hasPending(), false);
});

console.log('task logic');
await test('normal task shows only on its day; long-term task shows from its start day on', () => {
  const n = task('n'), p = task('p', { pinned: true, date: '2030-06-05' });
  assert.ok(appliesTo(n, '2030-06-01') && !appliesTo(n, '2030-06-02'));
  assert.ok(!appliesTo(p, '2030-06-04') && appliesTo(p, '2030-06-05') && appliesTo(p, '2031-01-01'));
});
await test('long-term task keeps a separate status per day; normal task has one', () => {
  let p = task('p', { pinned: true });
  p = withStatus(p, '2030-06-01', 'done', at(5));
  p = withStatus(p, '2030-06-02', 'partial', at(6));
  assert.equal(statusOn(p, '2030-06-01'), 'done'); assert.equal(statusOn(p, '2030-06-02'), 'partial'); assert.equal(statusOn(p, '2030-06-03'), 'todo');
  p = withStatus(p, '2030-06-01', 'todo', at(7));
  assert.equal(statusOn(p, '2030-06-01'), 'todo'); assert.equal(Object.keys(p.log).length, 1);
  assert.equal(statusOn(withStatus(task('n'), '2030-06-09', 'done', at(5)), '2030-06-01'), 'done');
});
await test('sections: long-term, project groups (case-insensitive), singles; sorted by time', () => {
  const list = [
    task('s1'), task('g1', { group: 'Website', time: '10:00' }), task('g2', { group: 'website', time: '09:00' }),
    task('p', { pinned: true }), task('s2', { time: '08:00' }),
  ];
  const sec = buildSections(list);
  assert.deepEqual(sec.pinned.map((t) => t.id), ['p']);
  assert.equal(sec.groups.length, 1); assert.equal(sec.groups[0].label.toLowerCase(), 'website');
  assert.deepEqual(sec.groups[0].tasks.map((t) => t.id), ['g2', 'g1']);
  assert.deepEqual(sec.singles.map((t) => t.id), ['s2', 's1']);
});
await test('progress counts partly done as half', () => {
  const l = [task('a', { status: 'done' }), task('b', { status: 'partial' }), task('c'), task('d')];
  assert.deepEqual(progress(l, '2030-06-01'), { total: 4, done: 1, partial: 1, percent: 38 });
  assert.equal(progress([], 'x').percent, 0);
});
await test('shiftDate crosses month, year and DST boundaries', () => {
  assert.equal(shiftDate('2030-01-31', 1), '2030-02-01');
  assert.equal(shiftDate('2030-01-01', -1), '2029-12-31');
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftDate('2030-03-31', 1), '2030-04-01');
});
console.log(`\n${passed} tests passed`);

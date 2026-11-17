import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave } from './autosave.js';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('edits during a save queue immutable snapshots without overlapping writes', async () => {
  const writes = [], releases = [];
  const saver = createAutosave({ save: snapshot => { writes.push(snapshot); return new Promise(resolve => releases.push(resolve)); } });
  const note = { note: 'first' };
  saver.schedule(note);
  note.note = 'mutated';
  saver.schedule({ note: 'second' });
  saver.schedule({ note: 'latest' });
  assert.deepEqual(writes, [{ note: 'first' }]);
  releases.shift()(); await tick();
  assert.deepEqual(writes, [{ note: 'first' }, { note: 'latest' }]);
  assert.equal(saver.state().pending, true);
  releases.shift()(); await tick();
  assert.equal(saver.state().pending, false);
});

test('failed saves retain edits and retry the latest snapshot', async () => {
  let fail = true; const writes = [];
  const saver = createAutosave({ save: async snapshot => { if (fail) throw new Error('offline'); writes.push(snapshot); } });
  saver.schedule({ note: 'first' }); await tick();
  saver.schedule({ note: 'latest' });
  assert.equal(saver.state().pending, true);
  assert.equal(writes.length, 0);
  fail = false; saver.retry(); await tick();
  assert.deepEqual(writes, [{ note: 'latest' }]);
  assert.equal(saver.state().pending, false);
});

test('discard cancels a pending debounced note save', async () => {
  const writes = [];
  const saver = createAutosave({ save: async snapshot => writes.push(snapshot) });
  saver.schedule({ note: 'discard' }, 10);
  saver.dispose();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(writes, []);
});

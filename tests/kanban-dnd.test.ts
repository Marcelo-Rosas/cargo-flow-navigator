/**
 * Unit tests for src/lib/kanban-dnd.ts
 *
 * Run with vitest (add `vitest` as a devDependency and configure vite.config.ts
 * with `test: { environment: 'node' }` to run these without a DOM):
 *
 *   npx vitest run tests/kanban-dnd.test.ts
 *
 * For now, the helpers can also be verified by running:
 *   npx tsx tests/kanban-dnd.test.ts
 */

// ---------------------------------------------------------------------------
// Minimal test harness (no external runner required)
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
    failed++;
  }
}

function expect<T>(actual: T) {
  return {
    toEqual(expected: T) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a !== e) {
        throw new Error(`Expected:\n    ${e}\n  Received:\n    ${a}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, received: ${JSON.stringify(actual)}`);
      }
    },
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${String(expected)}, received: ${String(actual)}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers under test
// ---------------------------------------------------------------------------
// NOTE: These are inlined here so the file can run with `npx tsx` without
// needing path-alias resolution.  The canonical source is src/lib/kanban-dnd.ts.
import { findContainer, moveItem } from '../src/lib/kanban-dnd';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const INITIAL = {
  todo: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  done: [{ id: 'd' }, { id: 'e' }],
  blocked: [] as { id: string }[],
};

// ---------------------------------------------------------------------------
// findContainer
// ---------------------------------------------------------------------------
console.log('\nfindContainer');

test('returns the column id for an item inside it', () => {
  expect(findContainer(INITIAL, 'a')).toBe('todo');
  expect(findContainer(INITIAL, 'd')).toBe('done');
});

test('returns the column id itself when id is a column (empty droppable)', () => {
  expect(findContainer(INITIAL, 'blocked')).toBe('blocked');
  expect(findContainer(INITIAL, 'todo')).toBe('todo');
});

test('returns null for unknown ids', () => {
  expect(findContainer(INITIAL, 'NOPE')).toBeNull();
});

// ---------------------------------------------------------------------------
// moveItem — same column (reorder)
// ---------------------------------------------------------------------------
console.log('\nmoveItem — reorder within same column');

test('reorders items forward within the same column', () => {
  const result = moveItem(INITIAL, 'a', 'c');
  expect(result?.todo.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  expect(result?.done).toEqual(INITIAL.done); // other columns unchanged
});

test('reorders items backward within the same column', () => {
  const result = moveItem(INITIAL, 'c', 'a');
  expect(result?.todo.map((i) => i.id)).toEqual(['c', 'a', 'b']);
});

test('returns null when active and over are the same item', () => {
  expect(moveItem(INITIAL, 'a', 'a')).toBeNull();
});

// ---------------------------------------------------------------------------
// moveItem — between columns
// ---------------------------------------------------------------------------
console.log('\nmoveItem — move between columns');

test('moves item to middle of another column (over an item)', () => {
  // Move 'a' from todo to done, placing it at index of 'd'
  const result = moveItem(INITIAL, 'a', 'd');
  expect(result?.todo.map((i) => i.id)).toEqual(['b', 'c']);
  expect(result?.done.map((i) => i.id)).toEqual(['a', 'd', 'e']);
});

test('moves item to end of another column (over the column itself / empty droppable)', () => {
  // over.id === column id → append at end
  const result = moveItem(INITIAL, 'a', 'done');
  expect(result?.todo.map((i) => i.id)).toEqual(['b', 'c']);
  expect(result?.done.map((i) => i.id)).toEqual(['d', 'e', 'a']);
});

test('moves item into an empty column (over the column id)', () => {
  const result = moveItem(INITIAL, 'a', 'blocked');
  expect(result?.blocked.map((i) => i.id)).toEqual(['a']);
  expect(result?.todo.map((i) => i.id)).toEqual(['b', 'c']);
});

// ---------------------------------------------------------------------------
// moveItem — null / no-op cases
// ---------------------------------------------------------------------------
console.log('\nmoveItem — null / no-op cases');

test('returns null when overId is null', () => {
  expect(moveItem(INITIAL, 'a', null)).toBeNull();
});

test('returns null when activeId is not found', () => {
  expect(moveItem(INITIAL, 'GHOST', 'b')).toBeNull();
});

// ---------------------------------------------------------------------------
// Immutability: original state must not be mutated
// ---------------------------------------------------------------------------
console.log('\nmoveItem — immutability');

test('never mutates the original items state', () => {
  const before = JSON.stringify(INITIAL);
  moveItem(INITIAL, 'a', 'd');
  moveItem(INITIAL, 'a', 'done');
  moveItem(INITIAL, 'a', 'blocked');
  expect(JSON.stringify(INITIAL)).toBe(before);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

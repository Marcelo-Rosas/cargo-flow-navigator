import {
  getStatusConfig,
  getTriggerConfig,
  normalizeTriggerSource,
} from '../src/lib/load-composition-config';

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
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${String(expected)}, received: ${String(actual)}`);
      }
    },
  };
}

console.log('\nload-composition-config');

test('normalizes realtime aliases safely', () => {
  expect(normalizeTriggerSource('realtime')).toBe('realtime');
  expect(normalizeTriggerSource('real_time')).toBe('realtime');
  expect(normalizeTriggerSource(' real-time ')).toBe('realtime');
});

test('falls back to batch for unknown trigger values', () => {
  expect(normalizeTriggerSource('unknown-value')).toBe('batch');
  expect(normalizeTriggerSource(null)).toBe('batch');
});

test('returns trigger config for unknown input via fallback', () => {
  expect(getTriggerConfig('on_save').label).toBe('Auto');
  expect(getTriggerConfig('invalid').label).toBe('Batch');
});

test('returns status config fallback for unknown statuses', () => {
  expect(getStatusConfig('approved').label).toBe('Aprovado');
  expect(getStatusConfig('legacy_status').label).toBe('Pendente');
  expect(getStatusConfig(undefined).label).toBe('Pendente');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

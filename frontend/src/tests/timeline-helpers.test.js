import test from 'node:test';
import assert from 'node:assert/strict';

function calculateGapMinutes(startTime, endTime) {
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

function mergeTimeline(routineBlocks, slots) {
  const combined = [];
  routineBlocks.forEach((rb) => {
    combined.push({
      type: 'routine',
      id: `rb-${rb.id}`,
      startTime: rb.start_time.slice(0, 5),
      endTime: rb.end_time.slice(0, 5),
      label: rb.label || 'Routine',
    });
  });

  slots.forEach((s) => {
    combined.push({
      type: 'slot',
      id: `slot-${s.id}`,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      item: s.item,
    });
  });

  combined.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const result = [];
  let lastEnd = '08:00';

  combined.forEach((entry) => {
    if (entry.startTime > lastEnd) {
      const gapMin = calculateGapMinutes(lastEnd, entry.startTime);
      if (gapMin >= 15) {
        result.push({
          type: 'free',
          startTime: lastEnd,
          endTime: entry.startTime,
          durationMin: gapMin,
        });
      }
    }
    result.push(entry);
    if (entry.endTime > lastEnd) {
      lastEnd = entry.endTime;
    }
  });

  if (lastEnd < '22:00') {
    const gapMin = calculateGapMinutes(lastEnd, '22:00');
    if (gapMin >= 15) {
      result.push({
        type: 'free',
        startTime: lastEnd,
        endTime: '22:00',
        durationMin: gapMin,
      });
    }
  }

  return result;
}

test('calculateGapMinutes correctly computes duration between time strings', () => {
  assert.equal(calculateGapMinutes('09:00', '10:30'), 90);
  assert.equal(calculateGapMinutes('14:15', '15:00'), 45);
  assert.equal(calculateGapMinutes('08:00', '08:00'), 0);
});

test('mergeTimeline correctly inserts free slots between routine blocks and scheduled tasks', () => {
  const routineBlocks = [
    { id: 1, start_time: '12:00:00', end_time: '13:00:00', label: 'Lunch' },
  ];
  const slots = [
    { id: 10, start_time: '09:00:00', end_time: '10:00:00', item: { raw_text: 'Study Math' } },
  ];

  const timeline = mergeTimeline(routineBlocks, slots);

  assert.equal(timeline[0].type, 'free');
  assert.equal(timeline[0].durationMin, 60);

  assert.equal(timeline[1].type, 'slot');
  assert.equal(timeline[1].startTime, '09:00');

  assert.equal(timeline[2].type, 'free');
  assert.equal(timeline[2].durationMin, 120);

  assert.equal(timeline[3].type, 'routine');

  assert.equal(timeline[4].type, 'free');
  assert.equal(timeline[4].durationMin, 540);
});

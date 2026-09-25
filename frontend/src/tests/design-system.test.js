import test from 'node:test';
import assert from 'node:assert/strict';
import { colors, categoryTokens, priorityTokens } from '../design-system/tokens.js';

test('design system tokens define base canvas, surface, and restrained accent', () => {
  assert.ok(colors.canvas, 'Canvas token must exist');
  assert.ok(colors.surface, 'Surface token must exist');
  assert.ok(colors.accent, 'Accent token must exist');
  assert.ok(colors.borderSubtle, 'Subtle border token must exist');
  assert.ok(colors.textPrimary, 'Primary text token must exist');
});

test('category tokens support task, idea, reminder, and deadline without rainbow accents', () => {
  const categories = ['task', 'idea', 'reminder', 'deadline'];
  categories.forEach((cat) => {
    assert.ok(categoryTokens[cat], `Token configuration for ${cat} must exist`);
    assert.ok(categoryTokens[cat].label, `Label for ${cat} must exist`);
    assert.ok(categoryTokens[cat].bg, `Background for ${cat} must exist`);
    assert.ok(categoryTokens[cat].text, `Text color for ${cat} must exist`);
  });
});

test('priority tokens define 1-5 levels with appropriate urgency cues', () => {
  for (let p = 1; p <= 5; p++) {
    const config = priorityTokens[p];
    assert.ok(config, `Priority level ${p} must exist`);
    assert.ok(config.label, `Priority ${p} must have a label`);
    assert.ok(config.dot, `Priority ${p} must have a dot color`);
  }
  assert.equal(priorityTokens[5].label, 'Critical');
});

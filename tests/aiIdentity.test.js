import test from 'node:test';
import assert from 'node:assert/strict';
import { getCreatorResponse } from '../src/util/aiIdentity.js';

test('answers who made or owns the assistant with the requested creators', () => {
  for (const question of [
    'Who is your owner?',
    'Who is your creator?',
    'Who made you?',
    'Who created Gooloogulu?',
    'Who built CampusLearn?',
    'Who developed you?',
    'Who is the founder of CampusLearn?',
    'Who is the creator of Gooloogulu?',
  ]) {
    assert.match(getCreatorResponse(question), /Rohit Lonkar and Raj Dugane/);
  }
});

test('does not intercept unrelated questions', () => {
  for (const question of [
    'Who created the TCP protocol?',
    'Who created the TCP protocol for you?',
  ]) {
    assert.equal(getCreatorResponse(question), null);
  }
});

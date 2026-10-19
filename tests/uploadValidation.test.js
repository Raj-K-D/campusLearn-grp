import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_UPLOAD_SIZE_BYTES,
  safeStorageFileName,
  validateUploadFile,
} from '../src/util/uploadValidation.js';

test('accepts a non-empty upload within the configured size limit', () => {
  assert.equal(validateUploadFile({ name: 'notes.pdf', size: MAX_UPLOAD_SIZE_BYTES }), '');
});

test('rejects missing, empty, and oversized uploads with actionable messages', () => {
  assert.match(validateUploadFile(null), /Choose a file/);
  assert.match(validateUploadFile({ name: 'empty.pdf', size: 0 }), /empty/);
  assert.match(validateUploadFile({ name: 'large.pdf', size: MAX_UPLOAD_SIZE_BYTES + 1 }), /10 MB/);
  assert.match(validateUploadFile({ name: 'image.exe', size: 10 }), /Unsupported file type/);
});

test('allows callers to supply a stricter upload size limit', () => {
  assert.match(validateUploadFile({ name: 'large.pdf', size: 11 }, 10), /maximum allowed size is 1 MB/);
});

test('sanitizes storage names and prevents path traversal', () => {
  assert.equal(safeStorageFileName('../private notes.pdf'), '_private_notes.pdf');
  assert.equal(safeStorageFileName(''), 'upload');
});

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt', '.zip',
]);

export function validateUploadFile(file, maxSizeBytes = MAX_UPLOAD_SIZE_BYTES) {
  if (!file) return 'Choose a file to upload.';
  if (file.size === 0) return 'This file is empty.';
  const extension = String(file.name || '').match(/\.[^.]+$/)?.[0].toLowerCase();
  if (!extension || !ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    return 'Unsupported file type. Choose a PDF, Word document, PowerPoint, text file, or ZIP archive.';
  }
  if (file.size > maxSizeBytes) {
    const sizeInMegabytes = Math.max(1, Math.ceil(maxSizeBytes / (1024 * 1024)));
    return `File is too large. The maximum allowed size is ${sizeInMegabytes} MB.`;
  }
  return '';
}

export function safeStorageFileName(fileName) {
  const safeName = String(fileName || 'upload')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(-180);
  return safeName || 'upload';
}

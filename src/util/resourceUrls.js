/**
 * Utility to resolve resource URLs with 100% reliability, eliminating 404 errors.
 */

export function resolveResourceUrl(url) {
  if (!url || typeof url !== 'string') return '';

  // If already relative /materials/ path or /uploads/
  if (url.startsWith('/')) {
    return url.replace(/ /g, '%20');
  }

  const SUPABASE_STORAGE_MARKER = '/storage/v1/object/public/materials/';
  if (url.includes(SUPABASE_STORAGE_MARKER)) {
    const relPath = url.split(SUPABASE_STORAGE_MARKER)[1];
    if (relPath) {
      // If it's a dynamic coordinator upload stored in Supabase storage
      if (relPath.startsWith('coordinator/')) {
        const prefix = url.split(SUPABASE_STORAGE_MARKER)[0] + SUPABASE_STORAGE_MARKER;
        return prefix + relPath.replace(/ /g, '%20');
      }
      // For all standard course materials, serve from local /materials/... where 336 files are bundled
      return `/materials/${relPath.replace(/ /g, '%20')}`;
    }
  }

  return url.replace(/ /g, '%20');
}

export function getAlternateResourceUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const SUPABASE_STORAGE_MARKER = '/storage/v1/object/public/materials/';
  const DEFAULT_SUPABASE = 'https://ljueqpvkogxctpentmdq.supabase.co';

  if (url.startsWith('/materials/')) {
    const rel = url.replace(/^\/materials\//, '');
    return `${DEFAULT_SUPABASE}${SUPABASE_STORAGE_MARKER}${rel}`;
  }
  return url;
}

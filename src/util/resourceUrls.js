const MATERIALS_PATH = '/materials/';
const SUPABASE_STORAGE_MARKER = '/storage/v1/object/public/materials/';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');

function encodeStoragePath(path) {
  return path.split('/').map((segment) => {
    try {
      return encodeURIComponent(decodeURIComponent(segment));
    } catch {
      return encodeURIComponent(segment);
    }
  }).join('/');
}

export function resolveResourceUrl(url) {
  if (!url || typeof url !== 'string') return '';

  if (url.startsWith(MATERIALS_PATH) && SUPABASE_URL) {
    const path = url.slice(MATERIALS_PATH.length);
    return `${SUPABASE_URL}${SUPABASE_STORAGE_MARKER}${encodeStoragePath(path)}`;
  }

  return url.replace(/ /g, '%20');
}

export function getAlternateResourceUrl(url) {
  if (!url || typeof url !== 'string') return '';

  return resolveResourceUrl(url);
}

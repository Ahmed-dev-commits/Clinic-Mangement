/**
 * Environment detection utilities
 * Determines whether to use Supabase (cloud) or SQLite (local) backend
 */

// Check if we're running in Lovable cloud preview
export const isCloudEnvironment = (): boolean => {
  const hostname = window.location.hostname;
  return (
    hostname.includes('lovableproject.com') ||
    hostname.includes('lovable.app') ||
    hostname.includes('lovable.dev')
  );
};

// Check if local SQLite backend is available
export const checkLocalBackend = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:3001/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
};

// Determine which backend to use
export type BackendType = 'supabase' | 'sqlite' | 'demo';

export const getBackendType = async (): Promise<BackendType> => {
  // If in cloud environment, use Supabase
  if (isCloudEnvironment()) {
    return 'supabase';
  }
  
  // If local, check if SQLite backend is available
  const localAvailable = await checkLocalBackend();
  return localAvailable ? 'sqlite' : 'demo';
};

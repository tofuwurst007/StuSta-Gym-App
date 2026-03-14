import PocketBase from 'pocketbase';

// Single shared PocketBase client — import `pb` everywhere you need API access.
// The client automatically persists the auth token to localStorage under the key 'pocketbase_auth'.
export const pb = new PocketBase(import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090');

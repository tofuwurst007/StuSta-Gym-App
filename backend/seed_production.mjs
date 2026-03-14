/**
 * Run this ONCE after deploying PocketBase to production.
 * Usage: PB_URL=https://your-app.railway.app node seed_production.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const PB_URL = process.env.PB_URL;
if (!PB_URL) {
  console.error('ERROR: Set PB_URL env var first');
  console.error('  Example: PB_URL=https://your-app.railway.app node seed_production.mjs');
  process.exit(1);
}

// Read the original setup script and replace the URL
const setup = readFileSync(new URL('./setup.mjs', import.meta.url), 'utf8');
const patched = setup.replace(/http:\/\/127\.0\.0\.1:8090/g, PB_URL);

// Write to a temp file and run
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

writeFileSync('/tmp/setup_prod.mjs', patched);
execSync('node /tmp/setup_prod.mjs', { stdio: 'inherit' });

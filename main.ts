// FROST HARBOR — make.fun entry program.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json with buildDossier from vendor/makefun-game.ts.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Repo root derived from this file's location, never from process.cwd():
// the grader runs `node /bot/main.ts` from an arbitrary working directory.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function clearDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return;
  }
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

clearDir(outDir);
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
console.log('FROST HARBOR dossier written to ' + outDir);

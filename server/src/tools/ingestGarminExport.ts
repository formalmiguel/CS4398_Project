/**
 * FR-WER-08/09/10 — the Garmin export → recommendation ingestion path (OPEN-33).
 *
 * This is the ~one thing that was missing: the glue that READS the real export and connects it to
 * the two pieces that already exist — `GarminExportAdapter` (packet 08, frozen `1199d80`, parses the
 * export into `DailyMetricSet`s) and `POST /wearable/metrics` (packet 14a, upserts each set
 * idempotently via `MetricStore.ingest`). It composes them; it re-implements neither.
 *
 * ⛔ §8.4 — the real export is a teammate's ACTUAL health data and must NEVER enter the repo.
 *   This reads it from a LOCAL PATH passed as an argument. Nothing here is committed with data in it.
 *
 * ⛔ It POSTs through the public API on purpose (FR-WER-08 asks that real records be *loaded* through
 *   the System). It does NOT write to Mongo directly, and it lives in `server/src/tools/` — OUTSIDE
 *   `server/src/{recommendation,catalog,wearable}/`, so its `fetch` is not a network call in the
 *   recommendation path the FR-LIB-02 guard protects.
 *
 * ⛔ It is DISPLAY/INGEST glue, not a `(T)` unit: idempotency (FR-WER-09) is already owned and tested
 *   by `MetricStore.ingest`'s `(userId, date, name)` upsert, so re-running this is a no-op-safe update,
 *   not a duplicate. No frozen test; the demonstration is the deliverable (FR-WER-10 is `(D)`).
 *
 * Usage (run against the running dev server — `npm run dev` in another terminal):
 *   npm run ingest:garmin -- --export <dir> --email you@x.dev --password pw [--from 2023-01-01 --to 2024-12-31]
 *   npm run ingest:garmin -- --export <dir> --token <jwt> --dry-run
 *
 * `--export <dir>` is the unzipped export root (containing `DI-Connect-Aggregator/` and
 * `DI-Connect-Wellness/`). Override discovery with `--activity <file>` / `--sleep <file>` if your
 * export is laid out differently. `--dry-run` parses, adapts, and prints a summary without POSTing —
 * run it first to eyeball the metrics against your real data before touching the server.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { DailyMetricSet } from '@capstone/shared';

import { GarminExportAdapter } from '../wearable/GarminExportAdapter';
import type {
  GarminActivityRecord,
  GarminExport,
  GarminSleepRecord,
} from '../wearable/GarminExportAdapter';

interface Args {
  export?: string;
  activity?: string;
  sleep?: string;
  baseUrl: string;
  token?: string;
  email?: string;
  password?: string;
  from?: string;
  to?: string;
  dryRun: boolean;
}

const parseArgs = (argv: readonly string[]): Args => {
  const args: Args = { baseUrl: 'http://localhost:3001', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      i += 1;
      return v;
    };
    switch (flag) {
      case '--export': args.export = next(); break;
      case '--activity': args.activity = next(); break;
      case '--sleep': args.sleep = next(); break;
      case '--base-url': args.baseUrl = next(); break;
      case '--token': args.token = next(); break;
      case '--email': args.email = next(); break;
      case '--password': args.password = next(); break;
      case '--from': args.from = next(); break;
      case '--to': args.to = next(); break;
      case '--dry-run': args.dryRun = true; break;
      default: throw new Error(`unknown argument: ${flag}`);
    }
  }
  return args;
};

/** Find the files matching a name pattern under a directory (non-recursive; the export is flat). */
const filesMatching = (dir: string, test: (name: string) => boolean): string[] => {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter(test)
    .map((name) => join(dir, name))
    .sort();
};

/**
 * Read one export file into a flat array of records. The real files are JSON arrays of daily/nightly
 * objects; some Garmin exports wrap the array in a single-property object, so that shape is handled
 * too. Only entries carrying a string `calendarDate` are kept — the join key both sources share.
 */
const readRecords = <T extends { calendarDate: string }>(file: string): T[] => {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
  const rows: unknown[] = Array.isArray(parsed)
    ? parsed
    : (Object.values(parsed as Record<string, unknown>).find(Array.isArray) as unknown[] | undefined) ?? [];
  return rows.filter(
    (row): row is T =>
      typeof row === 'object' && row !== null && typeof (row as { calendarDate?: unknown }).calendarDate === 'string',
  );
};

const loadExport = (args: Args): GarminExport => {
  // Explicit overrides win; otherwise discover the two standard subfolders of the export root.
  const root = args.export;
  const activityFiles = args.activity
    ? [args.activity]
    : root
      ? filesMatching(join(root, 'DI-Connect-Aggregator'), (n) => n.startsWith('UDSFile_') && n.endsWith('.json'))
      : [];
  const sleepFiles = args.sleep
    ? [args.sleep]
    : root
      ? filesMatching(join(root, 'DI-Connect-Wellness'), (n) => n.endsWith('_sleepData.json'))
      : [];

  if (activityFiles.length === 0 && sleepFiles.length === 0) {
    throw new Error(
      'no export files found. Pass --export <unzipped-export-dir> (with DI-Connect-Aggregator/ and ' +
        'DI-Connect-Wellness/), or --activity <file> / --sleep <file> directly.',
    );
  }
  console.log(`activity files: ${activityFiles.map((f) => f).join(', ') || '(none)'}`);
  console.log(`sleep files:    ${sleepFiles.map((f) => f).join(', ') || '(none)'}`);

  return {
    activity: activityFiles.flatMap((f) => readRecords<GarminActivityRecord>(f)),
    sleep: sleepFiles.flatMap((f) => readRecords<GarminSleepRecord>(f)),
  };
};

/**
 * FR-WER-08 note: never fabricate. A metric absent from the export stays unavailable, not zero.
 * Metric names are DERIVED from the sets, never hard-coded (FR-WER-04 / FR-REC-11): a third metric
 * added under FR-WER-04 is counted here with no edit — the same reason the wellness view iterates
 * `metrics` by key rather than naming the two it happens to have today.
 */
const summarize = (sets: readonly DailyMetricSet[]): void => {
  const names = [...new Set(sets.flatMap((s) => Object.keys(s.metrics)))].sort();
  const dates = sets.map((s) => s.date).sort();
  const perName = names
    .map((n) => `${n} on ${sets.filter((s) => s.metrics[n]?.isAvailable === true).length}`)
    .join(', ');
  console.log(
    `\n${sets.length} daily metric set(s), ${dates[0] ?? '—'} … ${dates[dates.length - 1] ?? '—'}\n` +
      `  available: ${perName || '(no metrics)'}`,
  );
};

const login = async (baseUrl: string, email: string, password: string): Promise<string> => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { token?: string };
  if (typeof body.token !== 'string') throw new Error('login returned no token');
  return body.token;
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  const adapter = new GarminExportAdapter(loadExport(args));
  let sets = adapter.toMetricSets().sort((a, b) => a.date.localeCompare(b.date));
  if (args.from !== undefined) sets = sets.filter((s) => s.date >= args.from!);
  if (args.to !== undefined) sets = sets.filter((s) => s.date <= args.to!);
  summarize(sets);

  if (args.dryRun) {
    console.log('\n--dry-run: nothing was posted. Sample:');
    console.log(JSON.stringify(sets.slice(0, 3), null, 2));
    return;
  }
  if (sets.length === 0) {
    console.log('\nnothing to ingest in the selected range.');
    return;
  }

  let token = args.token;
  if (token === undefined) {
    if (args.email === undefined || args.password === undefined) {
      throw new Error('provide --token, or --email and --password to log in.');
    }
    token = await login(args.baseUrl, args.email, args.password);
  }

  // POST each set through the public API (FR-WER-08). Re-running is idempotent — MetricStore upserts
  // on (userId, date, name), so a second pass updates in place rather than duplicating (FR-WER-09).
  let ingested = 0;
  const failures: string[] = [];
  for (const set of sets) {
    const res = await fetch(`${args.baseUrl}/wearable/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(set),
    });
    if (res.status === 204) ingested += 1;
    else failures.push(`${set.date}: ${res.status} ${await res.text()}`);
  }

  console.log(`\ningested ${ingested}/${sets.length} day(s) via POST ${args.baseUrl}/wearable/metrics.`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} failed:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exitCode = 1;
  } else {
    console.log('FR-WER-10: now GET /wellness?date=<a scored day> to see a real metric drive the recommendation.');
  }
};

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

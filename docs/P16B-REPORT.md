# P16B — Executable Guards: Offline Recommendation Path, Metric Extensibility

**Packet:** `prompts/verification/16b-guards-network-extensibility.md`
**Branch:** `wp-16b-run` (off `dev` at `5762119`)
**Human owner:** Patrick Rucker
**Date:** 27 July 2026
**Requirements:** FR-LIB-02, FR-REC-11, FR-WER-04, NFR-MNT-06, NFR-MNT-07
**Status:** complete, **nothing committed** (§8.5 — the commit is the owner's assertion that they read the diff)

> **The short version.** The last two Inspection-verified requirements now have executable guards, so **NFR-MNT-07 is closed for all four (I) requirements**. Both guards were watched to fail on deliberate violations, watched to stay silent on the legitimate constructs that already exist, and run against Ryan's two unmerged branches. `npm run verify` is green at **453 tests — unchanged**, engine still 100%, all seven freeze entries intact.
>
> **Was this packet a real check or a formality?** A real check, but it did **not** find a violation. Every check was proven to fire on an injected violation, and the codebase — including the newest metric-handling code on both of Ryan's branches — is genuinely clean. **Three escalations are recorded below, none of them a code defect**; the most substantive is a documented deviation from the packet's extraction instruction that the guards could not have been written without.

---

## 1. What was built

| File | Status | What it is |
|---|---|---|
| `scripts/lib/strip-code.mjs` | **new** | `stripCommentsAndStrings()` extracted **verbatim**, plus a new `stripComments()` — see §5.1 |
| `scripts/guard-offline-recommendation.mjs` | **new** | FR-LIB-02 — Checks A, B, D |
| `scripts/guard-metric-extensibility.mjs` | **new** | FR-REC-11 / FR-WER-04 / NFR-MNT-06 — Checks A, B, C |
| `scripts/guard-single-placement.mjs` | **modified — import swap only** | inline lexer copy deleted, imported from the lib |
| `scripts/guard-engine-purity.mjs` | **modified — import swap only** | same |
| `package.json` | modified | two `guard:*` scripts, both added to `verify` before `test:coverage` |
| `.github/workflows/ci.yml` | modified | two named steps, each commented with its requirement |

**Nothing else was touched.** No file under `server/src/`, `engine/src/` or `web/src/`; no frozen test directory; `scripts/frozen-tests.json` read but never edited; `shared/src/contract.ts` read (to derive the `Decision` kinds) but not changed by a character.

```
$ git status --short
 M .github/workflows/ci.yml
 M package.json
 M scripts/guard-engine-purity.mjs
 M scripts/guard-single-placement.mjs
?? scripts/guard-metric-extensibility.mjs
?? scripts/guard-offline-recommendation.mjs
?? scripts/lib/strip-code.mjs
```

The two permitted edits are the import swap and nothing else: `4 insertions(+), 99 deletions(-)` across both files — one `import` line and one blank line each, against the two deleted 46-line copies.

---

## 2. What each guard checks — and, honestly, what it does not

### `guard-offline-recommendation.mjs` (FR-LIB-02)

- **Check A** — no outbound network client is **imported** anywhere in the recommendation path: `node:http/https/net/dns/dgram/tls` (and bare forms), `axios`, `node-fetch`, `undici`, `got`, `superagent`, `request`, `cross-fetch`, `ky` — by `import`, `require(...)`, or dynamic `import(...)`.
- **Check B** — no ambient network **global** is called: unqualified `fetch(`, `globalThis.fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`. These need no import and no dependency, which is why Check A alone is insufficient.
- **Check D** — `server/package.json` declares no HTTP-client dependency. Fires on `npm i axios -w server` *before a line of code exists*. This is an allow-nothing-named-below check, not an empty-dependencies check: `express`, `cors`, `mongodb`, `bcrypt`, `jsonwebtoken`, `dotenv` are expected and legal.

> **What it does not do, in one sentence:** it is the **inspection half of FR-LIB-02 only** — the requirement also demands the Essential FR-REC requirements be *demonstrated with outbound network access disabled*, which is a rehearsal against the running System that no static scan performs, and it **never greps for URLs** (a URL handed to an HTTP client is just a string argument; the guard catches the import and the call site).

### `guard-metric-extensibility.mjs` (FR-REC-11 / FR-WER-04 / NFR-MNT-06)

- **Check A** — `RecommendationEngine.ts` names no concrete rule type (any `*Rule` identifier other than the `RecommendationRule` interface), no derived metric name, and no derived `Decision` kind.
- **Check B** — no rule imports another rule, and no rule imports `RecommendationEngine`. All three specifier forms (`from`, `require`, dynamic `import`).
- **Check C** — a derived metric name appears **only** in the rule that consumes it and in `server/src/wearable/**` (the adapter that produces it — addition #1 of FR-REC-11's two).

> **What it does not do, in one sentence:** none of these checks **proves** the System is extensible — they prove the **shape** that makes an addition cheap; the actual proof is FR-REC-12 (add a real metric, report the diff), which is Conditional and was definitively cut on 26 Jul. The success message says so, deliberately, so a green line never reads as more than it is.

**Further limits, stated rather than discovered later:**
- Check A scans `RecommendationEngine.ts` itself. Content-branching moved into a helper file the engine imports would not be seen.
- Check C scans **all** of `server/src/**` (minus the wearable producer), plus `engine/src/**` and `shared/src/**`. That is broader than the packet's enumeration and deliberately so — it caught `server/src/analytics/` on `wp-15` with no edit.

---

## 3. "The recommendation path" — the definition, and the cost of its edges

This is the load-bearing definition in the offline guard; every check is downstream of it. It is written into the script's header.

| In the path | Why |
|---|---|
| `server/src/recommendation/**` | It *is* the recommendation path — the rules, the engine, `RecommendationScheduler` |
| `server/src/catalog/**` | FR-REC-03 draws the recommended workout from here; §4.2 makes this local seeded data, not a runtime API call |
| `server/src/wearable/**` | FR-WER-07 — the metrics enter here. The module whose entire job is fetching wearable data, and where FR-WER-11 (the live Garmin API) would land. **The single most likely place in this codebase for a real network call to appear.** |

**Deliberately outside it:**

- **`server/src/api/**`** — the HTTP **server**. It is Express, it is **inbound by definition**; scanning it for `http` would fire on the thing it is.
- **`server/src/db/**`** — Mongo, which **FR-LIB-02's own words permit**: *"shall depend on nothing beyond the System's own database."*

> ⚠️ **What that omission costs, stated plainly:** a network call placed in `server/src/api/` and called *from* the recommendation path is out of this guard's reach. That is a real hole, accepted deliberately — a guard that cannot distinguish inbound Express from an outbound call gets disabled within a week, and a disabled guard checks nothing at all. It is written in the script header, not just here.

⛔ The tempting narrowing — excluding `server/src/wearable/` to silence the `fetch` noise — was **not** taken. It would leave a real `fetch('https://connect.garmin.com/...')` unseen in exactly the module most likely to contain one. The receiver is discriminated instead of the directory (§4, FALSE-POS).

---

## 4. Must-fail exercises — **fourteen**, where eleven were required

Every check watched to fail on a deliberately introduced violation, then the violation removed. Each file was restored from an in-memory copy of its original bytes and **verified byte-identical** afterwards. `git status` was clean apart from this packet's own files at the end (§1).

### 4.1 The seven this packet owns

**[OFFLINE-A] Check A — an outbound client is imported** · `server/src/catalog/WorkoutCatalog.ts` · **exit 1**
```
FR-LIB-02 VIOLATION (Check A): server/src/catalog/WorkoutCatalog.ts:159 imports `axios`.
  An outbound network client in the recommendation path. Recommendation
  generation must depend on nothing beyond the System's own database.
```

**[OFFLINE-A2] Check A — `require('node:https')`, in the wearable module** · **exit 1**
```
FR-LIB-02 VIOLATION (Check A): server/src/wearable/GarminExportAdapter.ts:152 imports `node:https`.
```

**[OFFLINE-B] Check B — the ambient global `fetch()`, injected into the very file that has a `fetch` *method*** · **exit 1**
```
FR-LIB-02 VIOLATION (Check B): server/src/wearable/GarminExportAdapter.ts:152 calls the global `fetch()`.
  An ambient network call needs no import and no dependency, so Check A and
  the package manifest both miss it. `adapter.fetch(...)` is a method call on
  the FR-WER-01 port and is fine; an UNQUALIFIED fetch( is an outbound call.
```
> **This is the packet's load-bearing exercise.** The violation was injected into `GarminExportAdapter.ts`, whose `async fetch(...)` at line 145 does **not** fire. The guard distinguishes the global call from the FR-WER-01 port **in the same file**.

**[OFFLINE-D] Check D — an HTTP client in the manifest** · `server/package.json` · **exit 1**
```
FR-LIB-02 VIOLATION (Check D): server/package.json dependencies declares `axios`.
  An HTTP client dependency. The recommendation path must reach nothing beyond
  the System's own database — the workouts are vendored on disk (§4.2).
```

**[EXT-A] Check A — the engine names a concrete rule** · **exit 1**
```
FR-REC-11 VIOLATION (Check A): server/src/recommendation/RecommendationEngine.ts:64 names `SleepToIntensityRule`.
  The engine must evaluate registered rules WITHOUT knowledge of any rule's content...
```

**[EXT-A2] Check A — the engine branches on a derived metric name *and* a derived `Decision` kind** · **exit 1**
```
FR-REC-11 VIOLATION (Check A): ...RecommendationEngine.ts:64 names the metric `sleepScore`.
FR-REC-11 VIOLATION (Check A): ...RecommendationEngine.ts:64 names the Decision kind `WORKOUT_INTENSITY`.
FR-WER-04 / FR-REC-11 VIOLATION (Check C): ...RecommendationEngine.ts:64 names the metric `sleepScore`.
  Declared by: server/src/recommendation/SleepToIntensityRule.ts.
```

**[EXT-B] Check B — one rule imports a sibling rule** · **exit 1**
```
FR-REC-11 VIOLATION (Check B): server/src/recommendation/CaloriesToTargetRule.ts:37 imports the rule `SleepToIntensityRule`.
  Each rule shall be an INDEPENDENT registered mapping...
```
Re-proven across **all four** forms after Check B was widened: static `from`, `require(...)`, dynamic `import(...)`, and `./RecommendationEngine` — **all four caught, exit 1**.

**[EXT-C] Check C — a metric name in the persistence layer, in *code*** · `server/src/db/MetricStore.ts` · **exit 1**
```
FR-WER-04 / FR-REC-11 VIOLATION (Check C): server/src/db/MetricStore.ts:81 names the metric `sleepScore`.
  Declared by: server/src/recommendation/SleepToIntensityRule.ts.
```
> The same file names **both** metrics in its DR-05 header comment and does **not** fire. Comment vs. code is the whole distinction, and this exercise proves both halves of it in one file.

**[EXT-C2] Check C — a metric name in the API layer (the `wp-14a`/`wp-15` shape)** · `server/src/api/app.ts` · **exit 1**
```
FR-WER-04 / FR-REC-11 VIOLATION (Check C): server/src/api/app.ts:603 names the metric `activeCalories`.
```
> This is what makes §6's "both guards pass on Ryan's branches" a meaningful result rather than a blind spot: a metric name in that exact file **does** fire.

**[FALSE-POS] Check B false-positive case — `adapter.fetch(...)` must stay SILENT** · **exit 0, as required**
```
recommendation path (server/src/{recommendation,catalog,wearable}) imports no network client,
calls no ambient network global, and server/package.json declares none (FR-LIB-02, inspection half...)
```

### 4.2 16a's four, **re-proven after the helper extraction**

Required because breaking a working guard is **silent**: a weakened guard still exits 0 on clean code and `npm run verify` still passes.

**[16a-A]** second `findCandidateSlots` outside `engine/src` · **exit 1**
```
FR-RSC-03 / NFR-MNT-03 VIOLATION (Check A): there must be exactly one
`findCandidateSlots` definition, in engine/src.
  Found 2:
    engine/src/index.ts:183
    server/src/reschedule/RescheduleService.ts:815   <- outside engine/src: a second placement function
```

**[16a-B]** a function returning `PlacementResult` outside `engine/src` · **exit 1**
```
FR-RSC-03 VIOLATION (Check B): server/src/reschedule/RescheduleService.ts:815 is a function returning `PlacementResult`.
```

**[16a-C]** the re-implementation vocabulary tripwire · **exit 1**
```
FR-RSC-03 VIOLATION (Check C, tripwire): server/src/reschedule/RescheduleService.ts:815 declares `findNextFreeSlot`.
```

**[16a-PURITY]** an ambient global in `engine/src` · **exit 1**
```
FR-SCH-05 / CON-04 VIOLATION: the engine reached an ambient source of impurity.
  engine/src/index.ts:248  Date.now()
```

✅ **All four 16a checks still fire correctly after the extraction. The refactor did not weaken them.**

---

## 5. False-positive confirmations — proven silent on the real code

| Legitimate construct | Where | Result |
|---|---|---|
| `fetch(userId, date): Promise<DailyMetricSet>` — interface member (FR-WER-01) | `server/src/wearable/WearableAdapter.ts:19` | ✅ silent |
| `async fetch(_userId, date)` — the implementation | `server/src/wearable/GarminExportAdapter.ts:145` | ✅ silent |
| `adapter.fetch(...)` — a method call on a receiver | injected, exercise FALSE-POS | ✅ silent |
| `readFileSync` / `node:fs` / `node:path` — the **vendored** `free-exercise-db` subset | `server/src/catalog/WorkoutCatalog.ts:14–15` | ✅ silent — **disk is not network** (§4.2) |
| Both metric names in the DR-05 header **comment** | `server/src/db/MetricStore.ts:9–10` | ✅ silent |
| Both metric names in the DR-05 **comment** | `shared/src/contract.ts:252–256` | ✅ silent |
| `activeCalories`/`sleepScore` in comments | `server/src/recommendation/CaloriesToTargetRule.ts:5`, `GarminExportAdapter.ts` | ✅ silent |

**The attribution case could not be reproduced — see escalation 3.** The comment-stripping that would have handled it is in place and is proven by the two DR-05 cases above.

---

## 6. Worktree validation against Ryan's two unmerged branches

**Done. Both guards, both trees, read-only detached worktrees, both removed afterwards.**

### `origin/wp-14a-wellness-backend` @ `716a930`
```
--- offline guard ---        EXIT=0
--- extensibility guard ---  EXIT=0
```

### `origin/wp-15-analytics` @ `61e7e96`
```
--- offline guard ---        EXIT=0
--- extensibility guard ---  EXIT=0
```

```
$ git worktree list
C:/Users/maste/source/repos/Software Engineering Capstone  5762119 [wp-16b-run]
```
Both worktrees removed; `git worktree prune` run; nothing left in `../`.

### ⚠️ The passes were checked for vacuity, because "green while enforcing nothing" is this repo's known failure mode

A clean exit is only evidence if the guard actually reached the new code. It did:

- **`wp-14a`'s wellness read surface exists and is in scope.** `server/src/api/app.ts:685–707` carries the `POST /wearable/metrics` ingestion route and `GET /wellness`. It is inside Check C's scan set, and exercise **EXT-C2 proved a metric name in that exact file fires.** It contains none — **Ryan built the read surface generically**, and the guard's silence is a real result about his code.
- **`wp-15`'s analytics module was covered with no edit.** `server/src/analytics/HabitAnalytics.ts` is a directory that did not exist when the guard was written; the globbed scan picked it up automatically. It names no metric (it is a pure function over `Placement[]`), which is correct.
- **The only metric-name occurrences under `server/src` on either branch** are the two rules that declare them, `server/src/wearable/**` (the producer), and comments — exactly the permitted set.
- **`web/src/components/WellnessView.tsx:57–58`** names both metrics literally. **Not scanned, and that is the requirement, not an oversight** — see §7.

> ⛔ **No finding to escalate on either branch. No file on Ryan's branches was edited, read-only throughout.**

---

## 7. `web/src/**` — why it is not scanned, stated precisely

FR-WER-04 named the dashboard among its protected surfaces **until SRS v2.32**, when it was removed on the record (**OPEN-29**, raised and closed 27 Jul): selecting a chart series by metric name is **presentation**. The four surviving surfaces — engine, task model, persistence structure, existing rules — are all **structural**.

⚠️ **The justification was corrected at v2.34 and this report uses the corrected one.** The view layer is **not unobliged**: **FR-WEL-01** requires the wellness view to render *every metric in the Daily Metric Set* for the current date, *"rather than a hard-coded list, so a metric added under FR-WER-04 appears without changing this view."* That is a real obligation — **verified by demonstration (D)**, which is simply not this guard's to check. And `WellnessView.tsx` **already complies**: its current-date list is `Object.entries(metrics.metrics).map(...)`, generic; its two literal names build the **seven-day chart, which is FR-WEL-04 — a requirement that names both metrics itself.**

**That sentence, with the version and the issue number, is written into the script's header comment**, because an unexplained omission reads as a hole to the next person, who will either "fix" it or conclude the guard is decoration.

⚠️ **The carve-out is `web/src/**` and nothing else.** A metric name in `server/src/api/**` — including any wellness or analytics endpoint — is still a violation, and exercise EXT-C2 proves it fires.

---

## 8. Escalations

**Three. None is a code defect; the first is a design decision the owner should ratify.**

### 8.1 ⚠️ `scripts/lib/strip-code.mjs` exports a **second** function, `stripComments()` — a documented deviation from the packet

**The packet says:** create the lib file "exporting the function, copied character-for-character." I did exactly that for `stripCommentsAndStrings` — **not one character of its body was changed** (only `function` → `export function` on the declaration line, which the module boundary requires). **I then added a second, separately-authored function below it.**

**Why the guards cannot be written without it.** The four earlier guards look for **identifiers in code**, so blanking string bodies is pure gain. Both of 16b's guards look for things that **live inside strings**:

- an import specifier — `import ... from 'node:https'`, `require('axios')` (FR-LIB-02, Check A)
- a metric-name literal — `metrics['sleepScore']`, `seriesValue(set, 'sleepScore')` (FR-WER-04, Check C)

Run `stripCommentsAndStrings` over those and the module name and the metric name are blanked to spaces. **The guard would see nothing, exit 0, and enforce nothing** — precisely the failure mode §4.12(a) exists to prevent, and the one this repo has already shipped twice.

**Alternatives considered and rejected:**
- *Duplicate a comments-only lexer inside each new guard* — two more copies, which is the exact duplication the packet's extraction is eliminating.
- *Modify `stripCommentsAndStrings` to take a flag* — forbidden, and it would change the behaviour of four guards from a file none of their reviewers will open.

**What makes it safe rather than a second thing to trust:** the two functions are mechanically consistent, and it is checkable rather than asserted. Because `stripComments` removes exactly the comments the other removes and touches nothing else:
```
stripCommentsAndStrings(stripComments(src)) === stripCommentsAndStrings(src)
```
**Verified over all 40 `.ts`/`.tsx` files under `*/src`: 0 mismatches, 0 length drifts** (both functions preserve length exactly, so line numbers stay true). The property and the verification are written into the file's header.

> **The owner's call:** accept the second export, or have `stripComments` written by hand. It is additive and leaves the verbatim function untouched, but it *is* a deviation from the literal instruction and should not pass unnoticed.

### 8.2 ℹ️ The two lexer copies differed in a **third** place — immaterial, recorded for completeness

The packet states the copies differ "only in two trailing comments." **That is exactly true of the 46-line function body**, which I diffed character-for-character before moving it:
```
lenA 46  lenB 46
--- line 3   A: "  let state = 'code';"      B: "  let state = 'code'; // code | line | block | sq | dq | tpl"
--- line 4   A: "  const tplBraces = [];"    B: "  const tplBraces = []; // brace depth of each open ${ ... } interpolation"
total differing lines: 2
```
The **docblock immediately above** the function also differed (2 lines in `guard-single-placement`, 3 in `guard-engine-purity`). Per the instruction to keep the richer comment set, `guard-engine-purity`'s was kept. **No escalation was warranted** — the packet's claim about the body held exactly, and verbatim extraction was possible as promised.

### 8.3 ⚠️ The packet's false-positive case **(iii) does not exist on this branch** — the packet describes code that isn't there

The packet states: *"A source URL appears in the attribution. `server/src/catalog/attribution.ts` and `data/ATTRIBUTION.md` record where `free-exercise-db` came from… A substring match on `https://` fires on the very line that proves provenance."*

**`server/src/catalog/attribution.ts` contains no URL.** It is 20 lines and its only data is:
```ts
return [{ source: 'free-exercise-db', licence: 'The Unlicense' }];
```
`grep -rn "https\?://" server/src/{recommendation,catalog,wearable}` returns **nothing**. The URL lives in `data/ATTRIBUTION.md` — a `.md` file, which no check here opens (the scan is `.ts`/`.tsx` only).

**Reading, on both sides.** *It is a real false-positive risk:* if a future edit adds the source URL to `attribution.ts` for FR-LIB-10, a URL-matching check would fire on the line proving provenance. *It is not a live case:* no check in either guard matches URL text at all, by design — Checks A and B match the **import** and the **call site**, never the URL — so the case cannot arise even if the URL is added later. **I reported it rather than quietly treating the packet as satisfied**, per the packet's own instruction not to silently reconcile a contradiction. **No action taken and none needed;** the header comment records the actual state of `attribution.ts` so the next reader is not hunting for a URL that isn't there.

---

## 9. Definition of Done

| | |
|---|---|
| Every check proven to fail, with exact output | ✅ **14 exercises** (11 required), §4 |
| 16a's four checks re-proven after the extraction | ✅ §4.2 — all four still fire |
| False-positive cases proven to pass | ✅ §5 (attribution case: §8.3) |
| `git status` clean apart from this packet's files | ✅ §1; every mutated file restored byte-identical |
| Both guards pass on this branch | ✅ |
| Both guards run against `wp-14a` and `wp-15`, worktrees removed | ✅ §6 — both pass, and the passes were checked for vacuity |
| Extensibility guard is self-maintaining | ✅ §10 |
| `npm run verify` passes, both guards visibly in the chain | ✅ **453 tests**, engine 100% |
| `npm run lint` / `npm run typecheck` — zero errors | ✅ both exit 0 |
| All seven freeze entries intact | ✅ P04, P06, P08, P09, P11, P17a, P17c |
| Test count unchanged at 453 | ✅ **453** — this packet adds no tests |
| Not committed | ✅ |

---

## 10. Self-maintenance, demonstrated

⛔ The metric names and `Decision` kinds are **derived from source at run time**, never hard-coded — a guard that knew only today's two metrics would go green forever the moment a third landed.

- Metric names: read from each `requiredMetrics()` body under `server/src/recommendation/`, resolving module-level `const` aliases (both current rules use the alias form, e.g. `const SLEEP_SCORE = 'sleepScore'`).
- `Decision` kinds: parsed from the `export type Decision` union in `shared/src/contract.ts`.

**Demonstrated** by temporarily adding a third rule, `StressToRecoveryRule.ts`, declaring `stressLevel`:

```
=== third rule present: guard picks the new metric up with NO script edit ===
metric extensibility: ... 3 derived metric name(s) [activeCalories, sleepScore, stressLevel] ...
EXIT=0

=== now put the new metric on a forbidden surface (engine/src) ===
FR-WER-04 / FR-REC-11 VIOLATION (Check C): engine/src/index.ts:248 names the metric `stressLevel`.
  Declared by: server/src/recommendation/StressToRecoveryRule.ts.
EXIT=1
```

The new rule and its metric were policed immediately, **with zero edits to the script**. Both temporary files removed; tree restored.

**And the derivation fails loudly rather than quietly.** If a rule's `requiredMetrics()` yields no readable name, or the `Decision` union cannot be parsed, or no rule is found at all, the guard exits non-zero with a `DERIVATION FAILURE` message telling the reader to escalate — **it never falls back to a hard-coded list.** A guard with an empty subject would otherwise exit 0 and verify nothing.

---

## 11. What this closes

**NFR-MNT-07 — *"every requirement verified by Inspection (I) is enforced by a check that fails the build"* — is now satisfied for all four (I) requirements:**

| Requirement | Guard | Packet |
|---|---|---|
| FR-RSC-03 / NFR-MNT-03 | `guard-single-placement.mjs` | 16a |
| FR-SCH-05 / CON-04 | `guard-engine-purity.mjs` | 16a |
| **FR-LIB-02** | **`guard-offline-recommendation.mjs`** | **16b** |
| **FR-REC-11 / FR-WER-04 / NFR-MNT-06** | **`guard-metric-extensibility.mjs`** | **16b** |

All four entered the build by **route 2 of §4.12(a)** — generated from a human-authored specification, **with every individual check watched to fail.** Eleven transcripts were required; fourteen are recorded.

> **The two properties, one sentence each:**
>
> **Nothing in the recommendation path reaches the network** — the workouts are on disk and the metrics are in our own database, so 31 July does not depend on a conference-room wifi.
>
> **The recommendation engine does not know what its rules do** — so a third metric is two additions, and nobody edits the scheduler, the task model, the store, or another rule to make it work.

---

## 12. For the owner, before committing

1. **Ratify or reject escalation §8.1** (the second export in `strip-code.mjs`). Everything else is mechanical.

---

## ✅ 13. Owner's ratification — Patrick Rucker, 27 July 2026

**Accepted, and independently verified before accepting.** What I re-derived from the artifacts rather than from this report: `stripCommentsAndStrings` in `scripts/lib/strip-code.mjs` is **byte-identical** to `guard-engine-purity.mjs`'s copy on `dev` (character-for-character, not "looks the same"); the only **additions** to the two 16a guards are their single `import` lines, everything else being deletion; both guards are in the `verify` chain and in `ci.yml`; the extensibility guard reports its metric names as **derived** (`2 derived metric name(s) [activeCalories, sleepScore]`); `attribution.ts` genuinely contains no URL (§8.3 is a real packet defect, now corrected in the packet); and `npm run verify` is green at **453** with all seven freeze entries intact.

**§8.1 — RATIFIED.** The need is unavoidable: 16b's guards match on **import specifiers and metric-name literals, which are string bodies**, and the verbatim lexer blanks exactly those — without a comments-only view both guards exit 0 while enforcing nothing, which is the failure §4.12(a) exists to prevent. **The verbatim rule was not broken**: it governs that function's body, which is untouched; adding a sibling function is a different act. `stripComments()` enters the build by **route 2** like every other check here — the checks built on it were each watched to fail, and §5's false-positive cases prove it silent where it must be.

> ### ⚠️ **One correction to this report, and it matters more than the ratification.**
>
> §8.1 calls its safety evidence *"mechanical, not asserted."* **It is not.** The invariant
>
> ```
> stripCommentsAndStrings(stripComments(src)) === stripCommentsAndStrings(src)
> ```
>
> **holds for ANY non-corrupting function — including one that does nothing at all.** Substituting `identity` for `stripComments` was tried and **the equality is still true.** So the invariant proves this function does not *break* anything downstream; **it does not prove it removes comments**, and it must not be cited as evidence that the file is correct.
>
> **The conclusion survives because the real evidence is elsewhere and is sound** — §5's false-positive confirmations (the DR-05 header comments in `MetricStore.ts` and `contract.ts` name *both* metrics and the guard stays silent), plus a direct check: both names go **1 → 0** occurrences under `stripComments()`, with length preserved. **That is the behavioural test to re-run if either function is ever touched**, and the note in `strip-code.mjs` has been corrected to say so. *Recorded because the next person will re-run the invariant, see `true`, and conclude they are safe.*

**§8.2** — noted, immaterial, no action. **§8.3** — a genuine packet defect; **the packet has been corrected** so a replay does not hunt for code that does not exist, and it now also states the stronger rule the case was really teaching: **never match on a URL substring as the network signal — match the import and the call site.**

**Reporting a packet defect instead of quietly treating it as satisfied, and checking the two branch passes for vacuity instead of reporting green, are the two things that make the rest of this report credible.**
2. **Read the two permitted edits** to `guard-single-placement.mjs` / `guard-engine-purity.mjs` — they should be an import line and a deletion, nothing more. §4.2 is the evidence they still work.
3. **Ryan needs no work from this packet.** Both his branches pass; `web/src/**` is out of scope by requirement (§7).
4. Per §0, this packet's outcome needs a decision-log row in `docs/TEAM-MEETING.md` and a §9 status update in `CLAUDE.md` — **not written by this session**, since neither is this packet's file and the packet's permitted-files list does not include them.

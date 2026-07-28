# CRITICAL REQUIREMENTS — 16b Executable Guards: Offline Recommendation Path, Metric Extensibility

### MANDATORY DIRECTIVE ###

You are an expert TypeScript/Node engineer. **CRITICAL**: You are writing **two CI guards** and wiring them into the build. You are **not** writing application code, you are **not** writing tests, and you are **not** fixing anything a guard finds.

| | |
|---|---|
| **Phase** | **GUARD** — executable enforcement of the two remaining Inspection-verified requirements |
| **Human owner** | **Patrick Rucker** — Scheduling Algorithm Lead |
| **Depends on** | 08 (the wearable adapter), 10 (the recommendation engine + the two rules), 11 (the catalog + seeded libraries) — **all three merged to `dev` and green** |
| **Spec** | `docs/SRS-v2.md` §3.8.7 (FR-REC-11), §3.8.11 (FR-LIB-02), §3.8.6 (FR-WER-04), §4.5 (NFR-MNT-06, NFR-MNT-07), §5 (DR-05) · `CLAUDE.md` §4.2, §4.4, §4.8 · `docs/AGENTIC-TDD-WORKFLOW.md` §2.3 |
| **Companion packet** | **16a** (`prompts/verification/16a-guards-placement-purity.md`) — FR-RSC-03 and FR-SCH-05, **already merged**. This packet is the other half of the same split. |

---

## ⛔ **CRITICAL**: WHY THIS PACKET EXISTS

**MANDATORY**: Read this before anything else. It is the whole justification and it determines what a correct guard looks like.

> **An (I) requirement has no test, so it rots by default.** *(`AGENTIC-TDD-WORKFLOW.md` §2.3)*

Four requirements in this System are verified by **inspection**. 16a made two of them executable. These are the other two, and **each is violated by doing the locally simplest thing**:

**FR-LIB-02 — no network in the recommendation path.** The seeded workout library has ~5 exercises per tier. An agent asked to improve variety finds `free-exercise-db` published on the internet and writes six lines that pull it live. **The tests pass. The library gets better.** And on 31 July the demonstration runs on a conference-room network, or behind a captive portal, or not at all — and the failure appears in the one hour of the project that cannot be retried.

**FR-REC-11 — the engine evaluates rules without knowledge of their content.** An agent asked for a wellness dashboard, or for a third metric, or for a nicer reason string, adds one `if (rule instanceof SleepToIntensityRule)` to `RecommendationEngine.recommend`. It is three lines, it works, and **every test in the frozen packet-09 suite still passes** — because that suite tests two rules that both still behave. What is now false is the property that made §4.4's "extensible by addition" claim true, and nothing reports it.

> **MANDATORY**: `docs/SRS-v2.md` §4.5: *"Each one is violated by doing the locally simplest thing… **The inspection has to be executable, or it is decoration.**"*

**CRITICAL**: A guard that a future agent can satisfy by editing the guard is not a guard. **Every failure message you write must say, explicitly, that the correct response is to escalate to the human owner — never to add an exemption, never to relax a pattern, never to delete the check.**

---

## **MANDATORY**: Requirements In Scope

> **CRITICAL**: Quoted **VERBATIM** from `docs/SRS-v2.md`. Do not paraphrase. The phrasing is load-bearing — in particular *"nothing beyond the System's own database"* and *"two additions and no modifications"*, both of which decide what your guards must permit.

- **FR-LIB-02.** *(Essential, I)* **No component of the recommendation path shall make an external network call.** Recommendation generation shall depend on nothing beyond the System's own database. Verified by inspection **and by demonstrating every Essential FR-REC requirement with all outbound network access disabled.** *(This is what makes 31 July immune to a rate limit, an expired key, or a conference-room network.)*

- **FR-REC-11.** *(Essential, I)* Each mapping from metrics to a recommendation shall be an **independent, registered rule** declaring the metrics it consumes, the decision it produces, and its fallback. The engine shall evaluate registered rules **without knowledge of any rule's content.** Consequently **adding a metric shall be two additions and no modifications**: add it to the metric set, register a rule that consumes it. Verified by inspection: no existing rule, and no code in the scheduler, the task model, or the persistence layer's structure, requires editing to introduce a new one.

- **FR-WER-04.** *(Essential, I)* The Daily Metric Set shall be **extensible by addition**: introducing a new metric shall require adding it to the set and registering a rule that consumes it (FR-REC-11), and shall require **no change** to the scheduling engine, the task model, the persistence layer's structure, or any existing rule.

  > **⚠️ MANDATORY — read the v2.32/v2.34 clarification attached to FR-WER-04 in the SRS before writing Check C.** *A new metric shall be **ingested, stored, evaluated by its rule, and reflected in the resulting recommendation** with no change to any surface named above. **This requirement makes no claim about the view layer** — not because a view may ignore a new metric, but because **that obligation lives in FR-WEL-01**, which requires the current date's metrics to be rendered from whatever the set contains rather than a hard-coded list, and which is verified by **demonstration (D)**, not by your guard.* **The dashboard was in this list until v2.32 and was removed deliberately (OPEN-29, closed 27 Jul) — this is settled; do not re-open it, and do not "restore" the view layer to your scan.**

- **NFR-MNT-06.** *(Essential, I)* **Adding a wearable metric shall be an addition, not a modification** (FR-WER-04, FR-REC-11, DR-05). Verified by inspection, and exercised by FR-REC-12.

- **NFR-MNT-07.** *(Essential, I)* Every requirement verified by Inspection (I) is enforced by a check that fails the build.

### **CRITICAL**: Explicitly Out Of Scope

- **FR-RSC-03 / NFR-MNT-03 and FR-SCH-05 / CON-04** — **these are 16a, already merged.** `scripts/guard-single-placement.mjs` and `scripts/guard-engine-purity.mjs` exist and run in `verify`. **Do not extend, absorb, refactor or duplicate them.**
- **FR-REC-12** (demonstrate extensibility by actually adding a third metric) — **Conditional, and definitively cut on 26 Jul** (`CLAUDE.md` §6: no Conditional work will be undertaken at all). ⛔ **Do not add a metric. Do not add a rule.** Your guard checks the *shape* that would make such an addition cheap; it does not perform one, and it must not claim to.
- **The (D) half of FR-LIB-02** — *"demonstrating every Essential FR-REC requirement with all outbound network access disabled."* That is a **rehearsal**, it belongs to Patrick's step 7, and **a static scan does not perform it.** Your guard is the *inspection* half only. **Say that plainly in the header comment and in the success message.**
- **OPEN-28** (reconciling 17b's minimal `Catalog` port with packet 11's full `Catalog`) — a wiring item, not a guard. **Do not wire the catalog into anything.**
- **Any change to application behaviour.** This packet adds enforcement. **If a guard you write fails on the code as it stands, that is the finding — not a licence to edit `server/src/`, `engine/src/` or `web/src/`.**

---

## ⛔ **CRITICAL**: WHAT ALREADY EXISTS — DO NOT REBUILD IT

**MANDATORY**: Four guards run in `npm run verify` today. Read all four before writing a line. **Three of them stop at the engine, and that is the gap this packet fills.**

| Already enforced | Where | Scope — and why it does not cover you |
|---|---|---|
| `engine` and `shared` declare **zero** runtime dependencies | `scripts/guard-engine-deps.mjs` | **`engine` and `shared` only.** `server` legitimately depends on `express` and `mongodb`, so **the manifest trick cannot be reused wholesale here** — an offline check on `server/` has to be at the import and call site, not the dependency list. *(One narrow manifest check is still worth doing — see Check D.)* |
| `engine/src/**` may import only relative paths and `@capstone/shared` | the `no-restricted-imports` overrides in `.eslintrc.cjs` | **`engine/**` only.** Nothing restricts what `server/src/recommendation/` or `server/src/catalog/` may import. |
| The engine calls no ambient global — `fetch`, `Date.now`, timers, `process.env` | `scripts/guard-engine-purity.mjs` | **`engine/src/**` only.** The recommendation path is entirely under `server/src/`, which this guard never opens. |
| Exactly one `findCandidateSlots`, in `engine/src/` | `scripts/guard-single-placement.mjs` | A different requirement (FR-RSC-03). Useful as a **style and structure model** — see below. |

### **MANDATORY**: Follow the existing idiom, and reuse the existing helpers

**CRITICAL**: Read `scripts/guard-single-placement.mjs` and `scripts/guard-engine-purity.mjs` **in full** before writing. Match their shape: plain `.mjs`, no dependencies, a header comment that explains *why the guard exists and what it does not catch*, `console.error` on violation naming file + line + requirement, `process.exit(1)`, one honest line on success.

### ⛔ **MANDATORY**: Extract `stripCommentsAndStrings()` — do not make a third and fourth copy

Both existing guards carry a `stripCommentsAndStrings()` helper that blanks comments and string bodies **while preserving line numbers**. Your two guards need the same behaviour. **That would be four copies. Extract it instead — this is decided, not a question to bring back.**

**The owner has verified the two copies are functionally identical** — 46 lines each, differing only in two trailing comments (`// code | line | block | sq | dq | tpl` on the `state` declaration, and the `tplBraces` note). **So a verbatim extraction is possible, and verbatim is what is required.**

1. **Create `scripts/lib/strip-code.mjs`** exporting the function, **copied character-for-character**, keeping the **richer** of the two comment sets. ⛔ **Do not "improve" the lexer while moving it** — not a renamed variable, not a tightened condition, not a tidied branch. **If you find yourself wanting to change one character of the body, STOP and escalate**; the owner does it by hand.
2. **Import it in all four guards** — `guard-single-placement.mjs`, `guard-engine-purity.mjs`, and your two — deleting the two inline copies.
3. ⛔ **MANDATORY — re-prove 16a's guards afterward.** Editing a working guard is dangerous for one specific reason: **breaking it is silent.** A weakened guard still exits 0 on clean code, `npm run verify` still passes, and nobody finds out. So after the extraction you must re-run **16a's four must-fail exercises** — Check A, Check B, Check C (`guard-single-placement`) and the ambient-global check (`guard-engine-purity`) — introducing each violation, confirming a non-zero exit, removing it, **and transcribing the output in your report.** That is **four exercises in addition to your own seven.**

> **CRITICAL**: This is the only reason the refactor is permitted this close to the presentation. **The must-fail re-proof converts a silent risk into a caught one** — without it, leaving four copies would be the correct call. *(This is route 2 of `CLAUDE.md` §4.12(a): a guard may be generated from a human-authored specification **provided every check is watched to fail.** Skipping the exercise does not produce a guard; it produces a file.)*
- **MANDATORY**: Use `fileURLToPath`, not `URL.pathname`, for the repo root. **This repo's own path contains spaces and it is on Windows**; both existing guards carry that comment for a reason.
- **MANDATORY**: Glob directories; never hard-code a file list. New files land in these directories constantly and the guard must cover them **with no edit**.

---

## **MANDATORY**: What To Build

### 1. `scripts/guard-offline-recommendation.mjs` — FR-LIB-02

**CRITICAL**: First decide, and **write into the header comment**, what "the recommendation path" is as a set of directories. It is the load-bearing definition in this whole guard — everything the checks do is downstream of it.

**The path, and why each directory is in it:**

| Directory | Why it is in the recommendation path |
|---|---|
| `server/src/recommendation/**` | It **is** the recommendation path — the rules, the engine, and `RecommendationScheduler` |
| `server/src/catalog/**` | FR-REC-03 draws the recommended workout from here; §4.2 is the decision that this content is **local seeded data, not a runtime API call** |
| `server/src/wearable/**` | FR-WER-07 — the metrics that drive a recommendation enter here. **This is the module whose entire job is fetching wearable data, and FR-WER-11 (the live Garmin API) is the deferred version of exactly that. It is the single most likely place in this codebase for a real network call to appear.** |

**And what is deliberately NOT in it — state this in the header, because an unexplained omission reads as an oversight:**

- `server/src/api/**` — the HTTP **server**. It is `express`, inbound, by definition. Scanning it for `http` would fire on the thing it is.
- `server/src/db/**` — Mongo. **FR-LIB-02's own words permit it**: *"shall depend on nothing beyond the System's own database."*
- ⚠️ **Say honestly what that omission costs**: a network call placed in `server/src/api/` and called *from* the recommendation path is out of this guard's reach. **Do not silently pretend otherwise, and do not try to fix it by scanning the API layer** — a guard that cannot distinguish inbound Express from an outbound call will be disabled within a week.

**Check A — no outbound network client is imported.** Anywhere in the path: `node:http`, `node:https`, `node:net`, `node:dns`, `node:dgram`, `node:tls` (and their bare forms), `axios`, `node-fetch`, `undici`, `got`, `superagent`, `request`, `cross-fetch`, `ky` — by `import`, by `require(...)`, or by dynamic `import(...)`.

**Check B — no ambient network global is called.** `fetch(...)`, `globalThis.fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`. **These need no import and no dependency**, which is precisely why Check A alone is insufficient — the same argument `guard-engine-purity.mjs` makes in its own header.

#### ⛔ **CRITICAL**: The legitimate exceptions. Name them in the guard, and do NOT write the guard to fit the code.

**MANDATORY**: These three exist in the code **today**, they are **correct**, and a naive pattern fires on all three. `CLAUDE.md`'s own note on this packet: *"name the legitimate exceptions in the packet so the guard is not written to fit the code, and make every guard fail on purpose before trusting it — this project has shipped two guards that were green while enforcing nothing."*

**(i) ✅ `fetch` is a METHOD on the wearable adapter.** `WearableAdapter` declares `fetch(userId, date): Promise<DailyMetricSet>` (FR-WER-01), `GarminExportAdapter` implements it as `async fetch(...)`, and every caller writes `adapter.fetch(...)`. A bare-token match on `fetch` fires on the declaration, the implementation, and every call site.

> ⚠️ **MANDATORY — the wrong fix is worse than the false positive.** Excluding `server/src/wearable/` to make the noise go away leaves a real `fetch('https://connect.garmin.com/...')` **in the exact module where one is most likely to be written**, unseen forever. **You must distinguish the global call from a method call on a receiver** — an unqualified `fetch(` / `globalThis.fetch` is a violation; `<something>.fetch(` and a `fetch(` that is a class or interface member declaration are not. **Both halves, or you have built nothing.**

**(ii) ✅ `readFileSync` from `node:fs` in `WorkoutCatalog.ts` is CORRECT and must stay legal.** The `free-exercise-db` subset is **vendored** — committed at `server/src/catalog/data/free-exercise-db.subset.json` and read from disk. That is what makes FR-LIB-02 true *by construction* (§4.2, and the 27 Jul decision-log row says so explicitly). **Disk is not network.** The engine's ban on `node:fs` is a **purity** rule (FR-SCH-05, CON-04) and applies to `engine/src/` only — **conflating the two would break the catalog and reverse a decision the team already made.**

**(iii) ⚠️ A source URL appears in the attribution — BUT NOT WHERE THIS PACKET ORIGINALLY SAID.** *(Corrected 27 Jul, after the 16b run reported the packet describing code that is not there — §8.3 of `docs/P16B-REPORT.md`. The original text claimed the URL was in `server/src/catalog/attribution.ts`; **it is not, and never was.** That file's only data is `{ source: 'free-exercise-db', licence: 'The Unlicense' }` — no URL appears anywhere under `server/src/catalog/**.ts`. Packet 11b put the URL in **`server/src/catalog/data/ATTRIBUTION.md`**, a Markdown file no guard opens.)*

**So this case cannot be exercised on the current tree, and a run must say so rather than claim it satisfied.** ⚠️ **The underlying hazard is still real and the defence is still required**, because FR-LIB-10 obliges provenance to be recorded and a future run may put a URL in a `.ts` comment: **strip comments before matching, as both existing guards do**, and ⛔ **never match on a URL substring as the network signal at all** — match the *import* and the *call site*. A URL in a comment or a licence note is provenance, not a network call.

> ⚠️ **MANDATORY**: Stripping strings has a cost you must state in the header: **a URL passed to an HTTP client lives inside a string**, so the URL text itself is invisible to you. **Checks A and B are what catch a real call — the import and the call site, never the URL.** A guard whose comment implies it greps for URLs is claiming something it does not do.

**Check C — scan scope.** `*.ts`/`*.tsx` under the three path directories. **Exclude** `node_modules`, `dist`, `coverage`, `build`, and **every test directory** — `server/test/**` contains fixtures and doubles, and `server/test/wearable/**` and `server/test/catalog/**` are **frozen** (`1199d80`, `4b1fd4e`). Scanning only the `src` roots excludes them by construction. **Say that in the header.**

**Check D — the manifest half.** `server/package.json` declares no HTTP-client dependency (`axios`, `node-fetch`, `undici`, `got`, `superagent`, `request`, `cross-fetch`, `ky`) in `dependencies` or `devDependencies`. Cheap, and it fires on `npm i axios -w server` **before a line of code exists**. Model it on `scripts/guard-engine-deps.mjs`, but ✅ **`express`, `cors` and `mongodb` are expected and legal** — this is an allow-nothing-named-below check, not an empty-dependencies check.

### 2. `scripts/guard-metric-extensibility.mjs` — FR-REC-11, FR-WER-04, NFR-MNT-06

**CRITICAL**: FR-REC-11's obligation is *"the engine shall evaluate registered rules without knowledge of any rule's content"*, and FR-WER-04 names the exact four surfaces a new metric must not touch: **the scheduling engine, the task model, the persistence layer's structure, and any existing rule.** *(Four, not five — the dashboard was removed at v2.32; see the clarification quoted above.)* Translate those into checks decidable from source text.

**MANDATORY — the guard must be self-maintaining.** ⛔ **Do not hard-code `sleepScore` and `activeCalories` as the list of metric names.** A third rule added tomorrow would then be silently uncovered — the guard stays green and stops meaning anything, which is the exact failure mode §0.1 exists to prevent. **Derive the names**: read the rule files under `server/src/recommendation/` for the metric-name literals they declare/return from `requiredMetrics()`, and derive the `Decision` `kind` literals from the `Decision` union in `shared/src/contract.ts`. **A new rule and a new decision kind must be covered with no edit to your script.** If you conclude that derivation cannot be done reliably from source text, **stop and escalate** — say what you tried and what defeated it. Do not fall back to a hard-coded list without the owner's decision.

**Check A — the engine is content-agnostic.** `server/src/recommendation/RecommendationEngine.ts` may not name:
- any concrete rule type (e.g. an identifier matching `*Rule` **other than** the `RecommendationRule` interface it is typed against),
- any derived metric name,
- any derived `Decision` `kind` literal.

✅ Calling only the interface methods — `requiredMetrics()`, `apply()`, `fallback()` — is the correct shape and is what the file does today.

**Check B — rules are independent.** No file under `server/src/recommendation/` that implements `RecommendationRule` may import another rule, and no rule may import `RecommendationEngine`. **The dependency direction is one-way**: the engine knows the interface, the rules know nothing about each other or about the engine. A rule importing a sibling is FR-REC-11's *"independent"* becoming false.

**Check C — a metric name appears only where it may.** For each derived metric name, it may appear in:
- ✅ **the rule that consumes it** — that is the rule declaring what it needs;
- ✅ **`server/src/wearable/**`** — the adapter that *produces* it. **This is "add it to the metric set", i.e. addition #1 of FR-REC-11's two, and it is expected.**

It may **not** appear in — and these are FR-WER-04's four surfaces, quoted:
- ❌ `engine/src/**` *(the scheduling engine)*
- ❌ `shared/src/contract.ts` *(the task model — and `DailyMetricSet` is already `Record<string, Metric>`, keyed by name, exactly so this stays true; DR-05)*
- ❌ `server/src/db/**` *(the persistence layer's structure — `MetricStore` is keyed by `(userId, date, name)` for the same reason)*
- ❌ any **other** rule *(any existing rule)*
- ❌ `server/src/reschedule/**`, `server/src/api/**`, `server/src/catalog/**` *(nothing else has any business knowing a metric's name)*

> ⛔ **`web/src/**` is DELIBERATELY OUT OF SCOPE, and this is not a loophole — it is the requirement.** FR-WER-04 named the dashboard until **v2.32**, when it was removed on the record (OPEN-29, closed 27 Jul). **The guard does not scan the view layer because FR-WER-04 makes no claim about it** — not because scanning it was inconvenient. ⚠️ **And note what that does NOT mean (v2.34): the view layer is not unobliged.** **FR-WEL-01** requires the wellness view to render **every metric in the Daily Metric Set** for the current date, *"rather than a hard-coded list, so a metric added under FR-WER-04 appears without changing this view"* — a real obligation, verified by **demonstration (D)**, which is simply not yours to check. **MANDATORY: write that sentence, with the version and the issue number, into the script's header comment.** An unexplained omission reads as a hole to the next person, who will either "fix" it or quietly conclude the guard is decoration.
>
> ⚠️ **The scope of that carve-out is `web/src/**` and nothing else.** A metric name reaching `server/src/api/**` — including any wellness or analytics endpoint — **is still a violation**, because that is the server shaping data around two named metrics, not a view choosing what to chart.

> ✅ **Named exception, and it is why you strip comments:** `server/src/db/MetricStore.ts` mentions **both** metric names **in a header comment**, in the sentence explaining that the store is keyed by name and is *"NEVER one document with a `sleepScore` field and an `activeCalories` field"* (DR-05). **That comment is the requirement being asserted, not violated.** `shared/src/contract.ts` carries the same note. Stripping comments handles both — **confirm it does, on the real files, and say so in your report.**

**MANDATORY — the honest limit, in the header comment and the success message.** None of these three checks proves the System is extensible. They prove the **shape** that makes an addition cheap. **The actual proof is FR-REC-12 — adding a real metric and reporting the diff — and it is Conditional and cut.** *(A guard whose output claims more than it verified is worse than no guard, because it stops people looking. 16a's Check C carries the same disclaimer for the same reason.)*

### 3. Wiring — `package.json` and `.github/workflows/ci.yml`

**MANDATORY**: Both guards run in `npm run verify` **and** in CI. A gate that is not enforced is not a gate; it is a hope.

- `package.json`: add `guard:offline-recommendation` and `guard:metric-extensibility`; add both to the `verify` chain **before** `test:coverage`, alongside the four existing guards. Keep the existing ordering idiom.
- `.github/workflows/ci.yml`: add both as named steps, each with a comment naming its requirement, matching the file's existing style.

> ✅ **`ci.yml` is correct as it stands** — 16a already added the `guard:tests-frozen` step and `fetch-depth: 0`. **You are adding two steps and nothing else.** If you believe you have found another defect in it, **escalate; do not fix it in passing.**

---

## ⚠️ **CRITICAL**: THE WELLNESS AND ANALYTICS CODE IS NOT ON THIS BRANCH

**MANDATORY**: This packet runs on a branch off **`dev`**, and **`dev` has no wellness or analytics code at all** — no view, and no server-side read surface for either. That code is Ryan's packets 14/15, and it is **the newest, least-reviewed code in the repo that handles metrics**. It lives on two unmerged branches:

- **`origin/wp-14a-wellness-backend`** — the wellness **read surface in `server/src/api/`** (in scope for Check C), the UC-01 profile capture, and `web/src/components/WellnessView.tsx` (**not** in scope — see below)
- **`origin/wp-15-analytics`** — branched off it; carries a **frozen-pending RED suite** awaiting its gate

**MANDATORY: You must validate both guards against both trees before this packet is done.** Read-only, without switching branches and without merging anything:

```
git worktree add --detach ../_16b-check-14a origin/wp-14a-wellness-backend
# point the guards at that tree, run them, read the output
git worktree remove ../_16b-check-14a

git worktree add --detach ../_16b-check-15 origin/wp-15-analytics
git worktree remove ../_16b-check-15
```

- ✅ **Both guards pass on both trees** → say so in your report. The guards are validated against the real codebase.
- ⛔ **Either guard fires on either tree** → **STOP. This is an escalation, and it is the single most valuable outcome this packet can produce.** Report the file, the line, the check that fired, and your reading of whether it is (a) a genuine FR-WER-04 / FR-REC-11 violation, or (b) a false positive in your pattern.

### ✅ **MANDATORY**: One thing on that branch is ALREADY SETTLED — do not re-litigate it

`web/src/components/WellnessView.tsx` on `wp-14a-wellness-backend` reads its two history series **by literal metric name** (`seriesValue(set, 'sleepScore')`, `seriesValue(set, 'activeCalories')`). **This was found while authoring this packet, raised as OPEN-29, and CLOSED on 27 Jul: FR-WER-04 was narrowed at SRS v2.32 and no longer makes a claim about the view layer.** Check C does not scan `web/src/**`, so it will not fire, **and that is correct.**

⚠️ **Be precise about why, because the first answer recorded was wrong (corrected at v2.34).** Those two literal names build the **seven-day history chart**, which is **FR-WEL-04** — *"Display sleep score and active calories over at least the previous seven days"* — **a requirement that names both metrics itself.** Hard-coding them there is **satisfying** a requirement. The same file's current-date metric list is **already generic** (`Object.entries(metrics.metrics).map(...)`), satisfying **FR-WEL-01**'s explicit obligation to render whatever the set contains. **So the view is not exempt from extensibility — it already complies, under requirements verified by demonstration rather than by this guard.**

> **CRITICAL: Do not restore `web/src/**` to the scan, do not report this as a finding, and do not re-argue it.** It is a settled requirements decision with a revision-history entry and a decision-log row. *(Recorded here because a careful agent reading FR-WER-04's older wording elsewhere — a stale quote, a comment — would otherwise "discover" it and either widen the guard or escalate a closed question.)*

### ⛔ **MANDATORY**: What to do if a check fires on anything else on those branches

**Both branches add code that handles metrics and that Check C DOES cover** — in particular `wp-14a`'s wellness read surface under `server/src/api/`, and `wp-15`'s analytics code. **A metric name in either is a real finding**: that is the server shaping data around two named metrics, which is precisely what FR-WER-04's four surviving surfaces forbid.

1. ⛔ **Do not edit anything on Ryan's branches.** Different owner, different branch (`CLAUDE.md` §7.2, §8.5).
2. ⛔ **Do not add an exemption, and do not narrow the pattern until it stops firing.** **A guard that was relaxed until it passed verifies nothing** — and this project has already shipped two guards that were green while enforcing nothing.
3. ✅ **Report it**: the exact file and lines, the check, what the requirement says, and — clearly labelled as your reading, not your decision — whether you believe it is a genuine violation or a false positive, **with the reasoning for both sides.** Which it is, is a requirements judgement and it belongs to the owners (Patrick Rucker, with Ryan Woosley for his module).

> **CRITICAL**: If you skip the worktree validation, the guard has never been run against the code it was written to police, and the first time it executes will be inside somebody else's merge. **Say plainly in your report whether you did it and exactly what it returned on each tree.**

---

## **CRITICAL**: Files You May Create Or Edit

- `scripts/guard-offline-recommendation.mjs` *(new)*
- `scripts/guard-metric-extensibility.mjs` *(new)*
- `scripts/lib/strip-code.mjs` *(new — the extracted `stripCommentsAndStrings`, verbatim)*
- `scripts/guard-single-placement.mjs`, `scripts/guard-engine-purity.mjs` — **the import swap ONLY**, see the constraint below
- `package.json` — **only** the two new `scripts` entries and the `verify` chain
- `.github/workflows/ci.yml` — **only** the two new steps
- `docs/P16B-REPORT.md` *(new)* — see Definition of Done

## **CRITICAL**: Files You Must **NOT** Touch

- **⛔ `server/src/**`, `engine/src/**`, `web/src/**`** — you are writing the inspection, not the subject. **If a guard fails on this code, that is the finding. Report it; do not make it pass.**
- **⛔ Every frozen test directory** — `engine/test` (`ac06e70`), `server/test/reschedule` (`c30e784`), `server/test/wearable` (`1199d80`), `server/test/recommendation` (`59f4e8a`), `server/test/catalog` (`4b1fd4e`), `server/test/acceptance` (`8809158`), `server/test/replacement` (`47bb301`). `npm run guard:tests-frozen` re-hashes all seven and will catch an edit **even if you commit it**.
- **⛔ `scripts/frozen-tests.json`** — read it; never edit it. **Editing the manifest is editing the tests, one level removed** (§4.12).
- **⛔ `scripts/guard-engine-deps.mjs` and `scripts/guard-tests-frozen.mjs`** — two working guards cited by `ci.yml`. **Yours are additive; they do not absorb, replace, or refactor either.**
- ⚠️ **`scripts/guard-single-placement.mjs` and `scripts/guard-engine-purity.mjs` — ONE permitted edit each, and nothing else**: deleting the inline `stripCommentsAndStrings()` and importing it from `scripts/lib/strip-code.mjs`, per the extraction section above, **with 16a's four must-fail exercises re-run and transcribed.** ⛔ **No other change to either file** — not a rename, not a comment tidy, not a "while I'm here". **A harmless-looking refactor of a guard is exactly the diff nobody reads.**
- `shared/src/contract.ts` — the contract *(`CLAUDE.md` §4.7: a team decision, never an agent's refactor)*. **Read it to derive the `Decision` kinds. Do not change a character.**
- `.eslintrc.cjs` — **adding your checks there instead of in a script is not equivalent**: lint is switched off per-file by anyone with an `eslint-disable` comment; a script in the `verify` chain is not.
- `docs/SRS-v2.md`, `prompts/**` *(other than your own report)*

---

## **MANDATORY**: Verification Steps — Definition of Done

- [ ] **⛔ CRITICAL — every check has been PROVEN to fail.** For **each** of the seven checks — offline A (import), offline B (ambient global), offline D (manifest), extensibility A (engine names a rule), extensibility B (rule imports a rule), extensibility C (metric name on a forbidden surface), **and the `adapter.fetch()` false-positive case** — temporarily introduce the violation, run the guard, **confirm it exits non-zero with a message naming the requirement**, then remove it. **Record all seven in the report with the exact output.** *(A guard nobody has watched fail is a guard nobody knows works — and two guards in this repo's history were green while enforcing nothing.)*
- [ ] **⛔ CRITICAL — 16a's four checks have been RE-PROVEN to fail after the helper extraction.** Check A, Check B, Check C (`guard-single-placement`) and the ambient-global check (`guard-engine-purity`), each watched to fail on a deliberate violation and transcribed. **Eleven must-fail transcripts in total, not seven.** *(If you escalated instead of extracting, record that here in its place.)*
- [ ] **CRITICAL — the false-positive cases have been PROVEN to pass.** Explicitly confirm, and record, that the guards are silent on: `adapter.fetch(...)` and `async fetch(` in `server/src/wearable/`, `readFileSync`/`node:fs` in `WorkoutCatalog.ts`, the attribution URL in `attribution.ts`, and the metric names in `MetricStore.ts`'s and `contract.ts`'s **comments**.
- [ ] **CRITICAL — `git status` is clean apart from your files** after the must-fail exercise. A violation left behind is a defect you introduced.
- [ ] Both guards **pass** on this branch's tree.
- [ ] Both guards **have been run against `origin/wp-14a-wellness-backend` and `origin/wp-15-analytics`** via detached worktrees, **both worktrees removed afterwards**, and **each result stated in the report** — pass, or escalation.
- [ ] The extensibility guard is **self-maintaining**: demonstrate it, by temporarily adding a third rule file declaring a new metric name and confirming the guard picks that name up **with no edit to the script**, then removing it. *(If you concluded derivation was not possible and escalated instead, record that here in its place.)*
- [ ] `npm run verify` passes, with both new guards visibly in the chain.
- [ ] `npm run lint` and `npm run typecheck` pass with **zero** errors *(NFR-MNT-04)*.
- [ ] **All seven freeze entries still intact** — `guard:tests-frozen` green.
- [ ] Test count is **unchanged at 453** — this packet adds no tests. *(The guards are scripts in the `verify` chain, not Jest suites. If your count moved, you wrote something you were not asked for.)*
- [ ] **`docs/P16B-REPORT.md`** records: what each guard checks and **in one honest sentence what it does not**; the definition of "the recommendation path" you used and why `api/` and `db/` are outside it; the seven must-fail transcripts; the false-positive confirmations; both worktree validation results; and **every escalation, with your reasoning on both sides.**
- [ ] **⛔ Do not commit.** The commit is the human owner's assertion that they read the diff *(`CLAUDE.md` §8.5)*.

> **MANDATORY**: **Do not add a Jest test, do not add a coverage threshold to `server/`, and do not add a metric or a rule.** NFR-MNT-01's 90% is the **engine**; whole-system 70% (NFR-MNT-02) is Conditional and cut; FR-REC-12 is Conditional and cut. Inventing a gate here is grading your own homework.

---

## **CRITICAL**: Escalation Clause

**⛔ STOP and report to the human owner — do not work around it — if:**

- **A guard fires on existing code**, on this branch or on either of Ryan's. **This is the packet succeeding.** Name the file, the line, the check, and your reading of whether it is a real violation or a false positive — **and do not decide it yourself.**
- **You cannot derive the metric names or the `Decision` kinds from source text** reliably. Say what you tried and what defeated it. **Do not silently hard-code a list** — a guard that only knows today's two metrics goes green forever the moment a third arrives.
- **You cannot separate the global `fetch(...)` from `adapter.fetch(...)`** without false positives. Say so and say why. **A narrower guard that is exactly right beats a broad one that gets disabled in three days — but the narrowing is the owner's call, not yours**, and ⛔ *"exclude `server/src/wearable/`"* is not an acceptable narrowing.
- **The `stripCommentsAndStrings` extraction cannot be done verbatim** — you find the two copies differ in substance, or moving the function requires changing a character of its body. **Stop and say so.** The owner does it by hand. *(Editing a merged guard's logic is the one thing this packet will not let an agent decide.)*
- **You conclude a check is redundant** with an existing guard or the lint rules. Say which, and quote the mechanism you think covers it. *(If you are right, that is worth knowing. If you are wrong, the owner catches it in a minute.)*
- Satisfying anything here would require touching a file on the **must NOT touch** list.

> **MANDATORY**: **An escalation is a success, not a failure.** A guard packet that finishes silently with everything green has, at best, confirmed that today's code is clean — and at worst, written seven checks that cannot fire. **Say which one you believe it was, and say what convinced you.**

---

### CRITICAL REQUIREMENT ###

**MANDATORY**: **This packet passes when `npm run verify` and CI both run two new guards that have each been WATCHED TO FAIL on a deliberate violation, WATCHED TO STAY SILENT on the four legitimate constructs that already exist in the code, and run against the two unmerged branches carrying the wellness and analytics code — the newest metric-handling code in the repo, and none of it is on this branch.**

**CRITICAL**: The two properties being defended are one sentence each:

> **Nothing in the recommendation path reaches the network — the workouts are on disk and the metrics are in our own database, so 31 July does not depend on a conference-room wifi.**
>
> **The recommendation engine does not know what its rules do — so a third metric is two additions, and nobody edits the scheduler, the task model, the store, or another rule to make it work.**

Every other line of this packet is machinery around those two sentences.

**CRITICAL**: Where this prompt and `docs/SRS-v2.md` disagree, **the SRS wins and this prompt is a defect.** Report it rather than reconciling it — an agent that silently resolves a contradiction has made a requirements decision nobody agreed to.

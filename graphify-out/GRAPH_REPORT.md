# Graph Report - GYM app  (2026-11-14)

## Corpus Check
- 65 files · ~48,791 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .graphify-bak 1, .rules 1)

## Summary
- 473 nodes · 1479 edges · 18 communities (15 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa3a1e9a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ExerciseForm.jsx
- Auth & Data Providers
- Body.jsx
- GitHub Pages Deploy Workflow
- Build Config & Dependencies
- Session.jsx
- MuscleDashboard.jsx
- Firestore Mock
- Firebase Auth Mock
- README Product Overview
- Exercise Catalog Build
- Graphify Usage Rules
- Body Silhouette Licensing
- RoutineEditor.jsx
- useAuth
- routineTips.js

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 36 edges
2. `useData()` - 30 edges
3. `Header()` - 28 edges
4. `ActiveSession()` - 28 edges
5. `Modal()` - 25 edges
6. `Today()` - 25 edges
7. `react` - 23 edges
8. `toISODate()` - 21 edges
9. `fireAndForget()` - 20 edges
10. `Empty()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `graphify skill (/graphify trigger)` --conceptually_related_to--> `graphify Knowledge Graph Usage Rules`  [INFERRED]
  .claude/CLAUDE.md → CLAUDE.md
- `start()` --indirect_call--> `exerciseById()`  [INFERRED]
  src/pages/Today.jsx → src/lib/__tests__/routineTips.test.js
- `FinishModal()` --indirect_call--> `describeLoad()`  [INFERRED]
  src/pages/Session.jsx → src/lib/load.js
- `App()` --calls--> `Progress()`  [EXTRACTED]
  src/App.jsx → src/pages/Progress.jsx
- `App()` --calls--> `ProgressDetail()`  [EXTRACTED]
  src/App.jsx → src/pages/Progress.jsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Exercise catalog build pipeline** — readme_free_exercise_db, scripts_build_catalog, readme_exercise_catalog [EXTRACTED 1.00]
- **Firebase backend: auth, Firestore cache, access rules, shared exercises** — readme_firebase_auth_google, readme_firestore_offline_cache, readme_firestore_rules_invited, readme_firestore_exercises_collection [INFERRED 0.85]

## Communities (18 total, 3 thin omitted)

### Community 0 - "ExerciseForm.jsx"
Cohesion: 0.16
Nodes (27): AnimationModal(), ExerciseInfoModal(), FrameAnimation(), PersonalNotesEditor(), VideoLink(), videoUrl(), ExerciseList(), toggle() (+19 more)

### Community 2 - "Auth & Data Providers"
Cohesion: 0.14
Nodes (30): DataContext, DataProvider(), withImages(), isoWeekKey(), weekdayIndex(), applyReorganization(), bodyCol(), deleteBodyMetric() (+22 more)

### Community 3 - "Body.jsx"
Cohesion: 0.13
Nodes (34): LineChart(), niceStep(), analyze(), BMI_RANGES, combosFor(), compOf(), diff(), FAT_RANGES (+26 more)

### Community 4 - "GitHub Pages Deploy Workflow"
Cohesion: 0.07
Nodes (30): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+22 more)

### Community 5 - "Build Config & Dependencies"
Cohesion: 0.07
Nodes (31): dependencies, firebase@^11.10.0, react@^18.3.1, react-dom@^18.3.1, react-router-dom@^6.30.6, devDependencies, vite@^5.4.21, vite-plugin-pwa@^0.21.2 (+23 more)

### Community 6 - "Session.jsx"
Cohesion: 0.07
Nodes (68): beep(), fmt(), RestTimer(), unlockAudio(), daysSinceWeight(), timestampToISODate(), toISODate(), reopenSession() (+60 more)

### Community 7 - "MuscleDashboard.jsx"
Cohesion: 0.16
Nodes (23): BodyMap(), LEVEL_COLORS, dayMonth(), fmt(), MuscleDashboard(), addDays(), formatWeekday(), now() (+15 more)

### Community 8 - "Firestore Mock"
Cohesion: 0.15
Nodes (14): addDoc(), autoId(), deleteDoc(), doc(), notify(), onSnapshot(), parentOf(), persist() (+6 more)

### Community 9 - "Firebase Auth Mock"
Cohesion: 0.22
Nodes (6): emit(), GoogleAuthProvider, listeners, signInWithPopup(), signInWithRedirect, signOut()

### Community 10 - "README Product Overview"
Cohesion: 0.20
Nodes (10): index.html PWA shell (root div, iOS web-app meta), /src/main.jsx entry module, npm run dev:mock (simulated Firebase in browser), Firebase Auth (Google), Firestore with offline cache, firestore.rules invited() access allowlist, Auto-deploy to GitHub Pages on push to main (.github/workflows/deploy.yml), GYM App (PWA for gym routines and set logging) (+2 more)

### Community 11 - "Exercise Catalog Build"
Cohesion: 0.25
Nodes (7): Exercise catalog (739 exercises, bundled), Firestore 'exercises' collection (user-created, shared), free-exercise-db (yuhonas, public domain), EXCLUDED, loadTypeFor(), out, raw

### Community 14 - "Body Silhouette Licensing"
Cohesion: 0.67
Nodes (3): src/data/body.json muscle silhouettes, Body silhouettes MIT License (ELABBASSI Hicham 2022), react-native-body-highlighter / @mjcdev/react-body-highlighter

### Community 16 - "RoutineEditor.jsx"
Cohesion: 0.15
Nodes (31): ExerciseThumb(), ImprovementTour(), LEVEL, CardioItemEditor(), StrengthItemEditor(), RoutinePreview(), Modal(), describeItemLoad() (+23 more)

### Community 17 - "useAuth"
Cohesion: 0.10
Nodes (46): react, react-router-dom, App(), AuthContext, AuthProvider(), signIn(), readableAuthError(), useAuth() (+38 more)

### Community 18 - "routineTips.js"
Cohesion: 0.14
Nodes (25): contribution(), GROUPS, isCompound(), isIsolation(), r1(), reviewRoutine(), sessionMinutes(), SMALL_ISOLATION (+17 more)

## Knowledge Gaps
- **10 isolated node(s):** `/src/main.jsx entry module`, `npm run dev:mock (simulated Firebase in browser)`, `firestore.rules invited() access allowlist`, `Auto-deploy to GitHub Pages on push to main (.github/workflows/deploy.yml)`, `Firestore 'exercises' collection (user-created, shared)` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 93 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useAuth` to `ExerciseForm.jsx`, `Auth & Data Providers`, `Body.jsx`, `Build Config & Dependencies`, `Session.jsx`, `MuscleDashboard.jsx`, `RoutineEditor.jsx`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `/src/main.jsx entry module`, `npm run dev:mock (simulated Firebase in browser)`, `firestore.rules invited() access allowlist` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & Data Providers` be split into smaller, more focused modules?**
  _Cohesion score 0.1431451612903226 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `useAuth` to `ExerciseForm.jsx`, `Body.jsx`, `Build Config & Dependencies`, `Session.jsx`, `RoutineEditor.jsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `Body.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12550607287449392 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `useAuth` to `ExerciseForm.jsx`, `Auth & Data Providers`, `Body.jsx`, `Session.jsx`, `MuscleDashboard.jsx`, `RoutineEditor.jsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `GitHub Pages Deploy Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
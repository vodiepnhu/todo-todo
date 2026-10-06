# Skill Strategy

## Available skills used or relevant

### VERIFIED

- `superpowers:using-superpowers`: session-level skill routing and required skill invocation. Use automatically at the start of meaningful work.
- `superpowers:brainstorming`: architectural discovery, approach comparison, design gate, and written design handoff. Use before behavior or architecture changes; this audit supplied the required design context.
- `superpowers:writing-plans`: converts an approved design into executable tasks with files, interfaces, tests, and verification. Use before implementation phases.
- `superpowers:verification-before-completion`: requires fresh command evidence before claims of completion, passing, or correctness. Use automatically at every handoff.
- `superpowers:systematic-debugging`: root-cause-first workflow for build, test, lint, runtime, or unexpected behavior failures. Use automatically when a failure is being fixed.
- `superpowers:test-driven-development`: failing-test-first workflow for feature, bugfix, and refactor code. Use automatically before implementation code; configuration-only work is the documented exception.
- `superpowers:executing-plans`: inline plan execution workflow when the user selects native execution. Use only after plan review and execution-method selection.
- `superpowers:requesting-code-review`: reviewer dispatch before merge or after substantial implementation. Use before any future merge if the target becomes a Git repository and reviewer tooling is available.
- `archify`: validated architecture/workflow/sequence/dataflow/lifecycle HTML diagrams. Use only when a visual artifact is requested or a relationship is materially clearer as a diagram.

### VERIFIED PROJECT SKILLS

- `ponytail`: use `/Users/nhuvo/.codex/.tmp/marketplaces/ponytail/skills/ponytail/SKILL.md` for minimal coding and dependency decisions.
- `caveman`: use `/Users/nhuvo/.agents/skills/caveman/SKILL.md` for terse technical communication when requested or active.

### UNAVAILABLE / UNVERIFIED

- `agentation`: npm package `agentation@3.1.2` is installed in the target, but no Codex `SKILL.md` was discovered.

Do not infer behavior, inputs, outputs, or safety classification for unavailable skills.

## Project mapping

| Trigger | Skill | Policy | Expected benefit |
| --- | --- | --- | --- |
| Start meaningful audit, feature, or refactor | `using-superpowers` | AUTO | Routes work to the right process before context grows. |
| Architecture or behavior change | `brainstorming` | ASK at design gate | Prevents speculative structure and preserves user intent. |
| Multi-step implementation | `writing-plans` | ASK for review/execution method | Makes files, interfaces, tests, and rollback explicit. |
| Before completion claim | `verification-before-completion` | AUTO | Prevents claims unsupported by fresh output. |
| Any failure or repeated debugging | `systematic-debugging` | AUTO | Stops symptom patching and repeated failed attempts. |
| Any new feature/refactor/bugfix code | `test-driven-development` | AUTO | Pins behavior before moving implementation. |
| Visual architecture or workflow request | `archify` | ASK | Produces a checked standalone artifact; overhead is unjustified for text-only maps. |
| Before merge/substantial completed change | `requesting-code-review` | ASK/required before merge | Adds independent review of migration risk. |
| Coding task where minimal code matters | `ponytail` | AUTO | Cuts unnecessary files, dependencies, and abstractions. |
| Terse status or review requested | `caveman` | AUTO when active | Cuts explanation tokens while preserving technical facts. |

## Router questions

Before loading many files or editing repeatedly:

1. Is there a verified skill matching the work?
2. Does it reduce repository scanning, repeated reasoning, or debugging loops enough to pay its setup cost?
3. Does its safety policy allow automatic use, or does it require user review?
4. Can the output be stored in `.codex/references` for reuse?

## Auto vs ask

- AUTO: using-superpowers, verification-before-completion, systematic-debugging, test-driven-development when work is authorized and in scope.
- ASK: brainstorming design gates, writing-plan handoff, archify artifact generation, code review dispatch, any external or broad operation.
- Unavailable skills: never invoke or recommend as if verified. `agentation` remains package-only until a Codex skill appears.

## Project-specific examples

- A future `features/planner` refactor uses brainstorming, TDD, systematic-debugging if tests fail, and verification before handoff.
- A large migration phase uses writing-plans; user chooses native or subagent execution before code starts.
- A future architecture review that needs a clickable dependency diagram may use archify after text architecture is stable.
- `ponytail` and `caveman` are verified. `agentation` remains unavailable/unverified as a Codex skill.

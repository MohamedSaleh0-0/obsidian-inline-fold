# Inline Fold (v2 rewrite) — Development Notes

This is the engineering log for the v2 rewrite — architecture
decisions, bugs found in v1, and what changed each round. For the
user-facing overview (what the plugin does, how to install and use it),
see [../README.md](../README.md).

---

Wrap text in a class's delimiters (default `[=hidden text=]`) and it
collapses into a small trigger badge inline; click or hover to reveal
it. Multiple fold classes can be defined, each with its own delimiters,
trigger text, and visual style. Works in both Live Preview and Reading
view, and now genuinely supports nesting one fold inside another.

## What changed from v1

- **Expansion state is file-scoped and persisted.** v1 tracked which
  folds were expanded in two module-global `Set`s — one keyed by raw
  editor offset (shared across *every* open editor in the vault, so two
  files with a fold at the same offset could expand together), one
  keyed by fold content text (shared across the whole vault in Reading
  view). Both are gone. `src/data/PluginDataStore.ts` is now the single
  source of truth, keyed by file path, persisted to `data.json`
  (debounced), and shared by Live Preview and Reading view alike —
  expanding a fold in one view or one pane is reflected everywhere else
  for that file, including after a restart.
- **Fold identity is content-based, not position-based**
  (`src/core/foldTree.ts`), so it survives edits elsewhere in the
  document and reloads across sessions, with an occurrence counter to
  disambiguate genuine duplicates.
- **Nesting actually works.** v1's parser detected nested folds but
  threw them away, keeping only non-overlapping top-level matches.
  `src/core/parser.ts` returns a real tree, and
  `src/render/domBuilder.ts` renders it recursively — the same function
  handles top-level and nested folds in both view modes.
- **Styling lives in one place and one real stylesheet.** v1 duplicated
  the ghost/pill/bracket/custom styling logic almost verbatim in the
  CM6 widget and the Reading-view processor, as direct inline styles.
  `styles.css`'s theme rules were dead code — nothing ever set the body
  attribute they matched against, and that mechanism couldn't have
  supported two different styleTypes on screen at once anyway.
  `src/render/styleEngine.ts` + `styles.css` now do this once, via CSS
  classes; only "custom" per-class colors flow through JS, and only as
  CSS custom properties.

## Project layout

```
src/
  core/            parser, fold-tree utilities, shared types — no Obsidian API, unit-tested
  data/             PluginDataStore: settings + expansion state, persisted
  render/           shared style application + recursive DOM builder
  live-preview/     CM6 StateField, widget, cursor behavior, effects
  reading-view/     markdown post-processor
  settings/         settings tab UI, defaults
  commands/         per-class wrap/unwrap + global expand/collapse commands
  main.ts           thin plugin entry point
tests/              vitest specs for core/
```

## Building

```
npm install
npm run build      # type-checks then produces main.js
npm run dev         # esbuild watch mode
npm test            # vitest
```

Copy `main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/inline-fold/` to install manually.

## Known, deliberate scope limits

- Reading-view expansion keys are consistent within one post-processor
  render call, not across the *entire* file for very long notes that
  Obsidian renders in more than one chunk — full whole-document
  consistency there would need an async read of the raw file per
  render, which wasn't worth the cost for a genuinely rare edge case
  (duplicate fold content split across separate render chunks).
- Reparsing is still whole-document on every change, matching v1's
  performance characteristics. Incremental reparsing of just the
  changed line range is a good next optimization but wasn't in scope
  for this pass.
- Keyboard accessibility (tabindex/role/aria-expanded/Enter-Space
  toggle on the fold capsule itself) was scoped out on purpose:
  the "Toggle expansion/collapse of folded text" command already
  covers keyboard-only toggling via a hotkey, so this wasn't judged
  worth the added complexity right now.

## Tier 1 additions (this round)

- **Expand all / Collapse all** — global commands for the whole note,
  plus one pair per fold class. Includes nested folds. Writes are
  batched through `PluginDataStore.setManyExpanded` so toggling many
  folds at once triggers one decoration rebuild, not one per fold.
- **Auto-pair delimiters** — typing a class's start symbol while
  editing auto-inserts its matching end symbol, cursor left in between
  (toggle in settings, on by default). The matching logic lives in
  `src/core/autoPair.ts` as a small pure function, independent of the
  CM6 wiring, so it's directly unit-tested. Deliberately narrow scope:
  plain typing only, single caret, no selection-wrapping, and symmetric
  delimiters (start === end) are skipped since typing through them is
  ambiguous.
- **Delimiter collision warnings** — the settings tab now flags a fold
  class whose start symbol is identical to, or a prefix-extension of,
  an earlier class's start symbol (the parser tries classes in array
  order and takes the first match, so such a class could never actually
  trigger). Added move-up/move-down buttons on each class card so the
  warning is actually actionable, not just informational.
- **Escaped pipe in content** — `\|` inside a fold now folds to a
  literal `|` instead of being read as the alias separator.

## Tier 2 additions (this round)

- **Reveal animation** — a short, tasteful pop (opacity + slight
  translate) when content actually becomes visible, via `@keyframes`
  rather than `transition` (display can't be transitioned, but an
  animation still plays correctly the moment an element starts matching
  a rule that also flips `display`). Deliberately *not* applied to the
  trigger reappearing on collapse, or to a note's initial render — both
  would just be visual noise, especially with many folds on screen at
  once. Respects `prefers-reduced-motion`.
- **Per-class icon** — an optional Lucide icon id (`FoldClass.icon`),
  rendered via Obsidian's `setIcon` before the trigger text. This is the
  one place `render/domBuilder.ts` now depends on the real `obsidian`
  module rather than staying framework-free — icon SVGs only exist
  inside the running app, there's no pure way around it. Old data.json
  files are backfilled with `icon: ""` on load so a settings text field
  never ends up literally showing "undefined".
- **Two more built-in presets** — "Underline" (minimal, dotted
  underline trigger) and "Badge" (small pill/counter style), alongside
  ghost/pill/bracket/custom.
- **Color-swatch pickers** for the three custom-style color fields,
  alongside (not replacing) the existing text inputs. The text field
  stays the source of truth — it's what allows values like
  `var(--text-accent)` for theme-awareness, which a plain `<input
  type=color>` can't represent — so the swatch is a one-way convenience
  that writes a hex value into the text field, not a live mirror of it.
- **Stable per-class CSS hook** — every fold now also gets an
  `inline-fold-class-{id}` class, so a user's own CSS snippet can target
  one specific fold class without fighting the theme rules.

## Tier 3 additions (this round)

- **Regex delimiters** — a class can opt in (`useRegex`) to interpret
  its start/end symbols as regular expressions, matched anchored at the
  current position (sticky `y` flag), instead of literal text. The
  parser's nesting/stack algorithm is unchanged; only how a start/end
  symbol is *recognized* differs. Scope note: this covers flexible
  start/end **pairs** (e.g. `-{3,}` as both delimiters, or
  whitespace-tolerant symbols) — it does not cover single self-contained
  pattern matches with no explicit delimiters at all (like auto-folding
  every URL in a note with nothing typed around it). That's a different,
  bigger feature (a "detector" mode) and wasn't attempted here.
  Auto-pair, the wrap-selection part of "Toggle encapsulation", and
  delimiter-collision detection all explicitly skip regex classes, since
  none of those operations are meaningful against a pattern rather than
  literal text — the settings tab explains this next to the toggle.
  Invalid regex is caught and surfaced as a settings warning rather than
  crashing the parse (an invalid pattern just never matches).
- **`FoldNode.contentFrom`** — added because regex delimiters exposed a
  latent bug: content's start offset used to be recomputed as `node.from
  + startSymbol.length`, which is wrong whenever the actual matched text
  isn't the same length as the pattern source string. The parser now
  records the real matched offset directly on the node once, and
  `domBuilder.ts` just reads it — this is also just more robust for the
  literal case, not only the regex one.
- **Fold navigation** — "Jump to next/previous fold" commands, cyclic
  (wrapping around at either end), plus "Start focus mode" which
  collapses everything in the note and jumps to the first fold. Pure
  navigation — it moves and scrolls the cursor, it doesn't expand
  anything, so revealing is still the existing toggle command/click.
- **Auto-collapse timer** — a global "Auto-collapse after (ms)" setting;
  a fold expanded by click re-collapses on its own after that delay.
  Separate from hover's existing recollapse-on-mouseleave. 0 disables
  it (default).
- Along the way, `commandManager.ts`'s hand-rolled line-offset
  accumulation was replaced with Editor's own `posToOffset`/
  `offsetToPos` (confirmed stable public API), which is both simpler
  and used for the new navigation commands' cursor placement.

## Deliberately not built this round

- **Self-test / quiz mode** (reveal counts, self-grading, a session
  summary) was flagged from the start as a bigger, separate lift once
  navigation existed. Navigation exists now, but the mode itself still
  needs its own design pass (does a "session" persist? how is grading
  represented?) rather than being bolted on here.
- A "detector" style regex mode with no explicit delimiters (see above)
  — a different feature from what was built, not a smaller version of it.

## Tier 4 additions (this round)

- **Rich content inside fold answers** — a small, intentionally limited
  inline-markdown parser (`core/inlineMarkdown.ts`: bold, italic, inline
  code, `[text](url)` links, `[[wikilinks]]`) now runs on fold content
  instead of setting it as plain `textContent`. This is genuinely new
  capability in **Live Preview**, where fold content is raw, unrendered
  source text. It deliberately doesn't call Obsidian's own
  `MarkdownRenderer`: that API is async and produces block-level `<p>`
  output, neither of which fits a synchronous, inline capsule.
  Wikilinks navigate via `app.workspace.openLinkText`.

  **In Reading view this is mostly a no-op**, and it's worth
  understanding why rather than assuming it "just works" there too: by
  the time our post-processor sees a paragraph's text, Obsidian's own
  renderer has already consumed any markdown syntax in it and turned it
  into real elements — there's typically nothing left in the plain text
  we read back out for the parser to find. Investigating this surfaced a
  more fundamental, pre-existing Reading-view limitation (not something
  this round introduced): the post-processor reads each candidate
  element's flattened `.innerText` and rebuilds it from scratch, which
  is what lets it detect a fold regardless of what's inside it, but also
  means any rich formatting Obsidian already applied *anywhere in that
  same element* — including outside the fold — gets discarded on
  rebuild. A version that walks individual text nodes instead would
  preserve that surrounding formatting, but breaks detecting a fold
  whose *own* content contains further markdown, because Obsidian's
  renderer splits the fold's start/end delimiters into two separate,
  disjoint text nodes the moment something like `**bold**` renders
  between them — so a single text node never contains the whole fold to
  parse. Neither option is strictly better: one silently loses
  formatting, the other silently fails to detect certain folds. The
  existing (loses-formatting) behavior was kept because its failure mode
  is more graceful — a plain capsule still beats a fold that doesn't
  render at all — and because I have no way to actually verify the
  text-node approach's visual behavior without a live Obsidian instance
  to test against. Documented here rather than silently traded off.

## Still remaining from the original Tier 4 list

- Export/import fold-class presets as shareable JSON
- A fold browser panel (list every fold in a note/vault, jump-to)
- Fold stats (counts, times revealed) — still blocked on the same
  self-test-mode design questions as before

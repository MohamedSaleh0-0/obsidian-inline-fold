# Inline Fold

Wrap any text in a delimiter pair and it collapses into a small, styled
badge right in the flow of your note — click or hover to reveal what's
hidden. Built for flashcard-style self-testing, but works for spoilers,
asides, footnote-style references, or anything else you'd rather keep
out of sight until you ask for it.

> **About the media in this README:** this repo doesn't have a real
> screen recording yet. The demo below is an **animated SVG mockup** —
> a stand-in that shows the actual interaction (click → reveal) so the
> README isn't just describing behavior in prose. Everywhere you see
> "*(placeholder)*" is meant to be swapped for a real recording. See
> [Replacing the placeholders](#replacing-the-placeholders) at the
> bottom for exactly how.

<p align="center">
  <img src="docs/media/hero-demo.svg" width="640" alt="Animated mockup: a fold badge being clicked to reveal its hidden content" />
  <br/>
  <sub><em>(placeholder mockup — not a real recording)</em></sub>
</p>

## What it does

Write:

```
The powerhouse of the cell is the [=mitochondria=].
```

See:

> The powerhouse of the cell is the **?**

Click (or hover, depending on your settings) the badge, and it expands
in place to show `mitochondria`. Collapse it again the same way. Works
identically in **Live Preview** and **Reading view**, and expand/collapse
state is shared between them and persists across restarts — expand
something, close Obsidian, come back tomorrow, and it's still expanded.

## Features

- **Multiple fold classes** — define as many delimiter pairs as you
  want (`[=…=]` for flashcards, `{{…}}` for asides, whatever you pick),
  each with its own trigger text, icon, and style.
- **Five built-in styles** (Ghost, Pill, Bracket, Underline, Badge) plus
  a fully custom style with your own colors, borders, and padding.
- **Real nesting** — a fold can contain another fold, which stays
  independently collapsible once its parent is expanded.
- **Rich content** — bold, italic, inline code, links, and `[[wikilinks]]`
  work inside revealed content in Live Preview.
- **Regex delimiters** — opt a class into matching its start/end symbols
  as patterns instead of fixed literal text.
- **Commands** for wrapping/unwrapping text, toggling a fold at the
  cursor, expanding/collapsing everything in a note (globally or per
  class), jumping to the next/previous fold, and starting a quick
  "focus mode" pass over a note.
- **Auto-pairing** — typing a class's start symbol inserts its matching
  end symbol automatically.
- **Auto-collapse timer** — optionally have a clicked-open fold
  re-collapse on its own after a delay, for timed self-testing.

<p align="center">
  <img src="docs/media/themes-overview.svg" width="620" alt="The five built-in style presets shown side by side" />
</p>

## Installation

**Manual install** (not yet on the Community Plugins list):

1. Download `main.js`, `manifest.json`, and `styles.css` from a
   [release](../../releases) (or build them yourself — see
   [Building from source](#building-from-source)).
2. Create a folder `<your vault>/.obsidian/plugins/inline-fold/` and
   put those three files in it.
3. In Obsidian: **Settings → Community plugins**, reload the plugin
   list, and enable "Inline Fold".

## Quick start

1. Open a note and type `[=your hidden text=]`.
2. Switch to (or stay in) Live Preview — it collapses into a small `?`
   badge.
3. Click it. It expands to show `your hidden text`.
4. Open **Settings → Inline Fold** to add your own fold classes, change
   the interaction mode, or pick a different style.

## Nested folds

A fold can contain another fold. The inner one only exists once the
outer one is expanded, and it collapses/expands independently after
that.

```
The mitochondria is the powerhouse ([=of the cell=]).
```

<p align="center">
  <img src="docs/media/nested-folds.svg" width="620" alt="A collapsed outer fold expanding to reveal a fold nested inside it" />
</p>

## Settings

<p align="center">
  <img src="docs/media/settings-panel.svg" width="560" alt="Mockup of the plugin's settings tab" />
  <br/>
  <sub><em>(placeholder mockup — not a real screenshot)</em></sub>
</p>

**Global**

| Setting | What it does |
|---|---|
| Interaction mode | Click, hover, or both, for revealing a fold. |
| Cursor behavior over collapsed folds | Whether the caret jumps over a collapsed fold or reveals its raw markdown as it gets close. |
| Protect collapsed boundaries | Keeps the caret from exposing raw markdown right at a fold's edges unless it's already expanded. |
| Hotkey expansion target | Whether the toggle command affects every fold on the line, or just the closest one. |
| Hover collapse delay | Grace period before a hover-revealed fold hides again. |
| Auto-pair delimiters | Typing a start symbol auto-inserts the matching end symbol. |
| Auto-collapse after (ms) | A clicked-open fold re-collapses on its own after this delay. 0 disables it. |

**Per fold class**

| Setting | What it does |
|---|---|
| Start / end symbol | The delimiter pair, or a regex pattern if "Use regex delimiters" is on. |
| Use regex delimiters | Interpret the symbols above as regular expressions. Disables auto-pair and the wrap/unwrap command for that class, since there's no fixed literal text to insert. |
| Trigger text | What shows on the collapsed badge (e.g. `?`). Can be overridden per-fold with `[=content|custom trigger=]`. |
| Icon | An optional [Lucide](https://lucide.dev) icon shown before the trigger text. |
| Style | Ghost / Pill / Bracket / Underline / Badge / Custom. |

## Commands

Open the command palette (`Cmd/Ctrl+P`) and search "fold":

- **Toggle expansion/collapse of folded text** — expand/collapse at the cursor.
- **Toggle encapsulation: *[class name]*** — wrap the selection or word under the cursor in that class's delimiters, or unwrap if the cursor is already inside one.
- **Expand all / Collapse all folds in note** — every fold, or...
- **Expand all / Collapse all: *[class name]*** — just one class's folds.
- **Jump to next / previous fold** — cyclic navigation.
- **Start focus mode** — collapses everything and jumps to the first fold, for reviewing a note top to bottom.

Assign hotkeys to whichever of these you use often via **Settings → Hotkeys**.

## Tips

- **Custom trigger per fold**: `[=answer|💡=]` shows `💡` instead of the class's default trigger text for just that one fold.
- **Literal `|` in content**: escape it as `\|` — `[=A \| B=]` folds to `A | B` with no alias split.
- **A fold class per purpose**: e.g. `[=…=]` for flashcards, `{{…}}` for spoilers, `<<…>>` for asides — each can have its own icon and style so they're visually distinct at a glance.

## Building from source

```bash
npm install
npm run build      # type-checks, then produces main.js
npm run dev          # esbuild watch mode
npm test              # runs the test suite
```

Copy the resulting `main.js`, plus `manifest.json` and `styles.css`,
into your vault as described in [Installation](#installation).

For architecture notes, what changed from v1, and why certain things
were deliberately scoped out, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Replacing the placeholders

Everything under `docs/media/` right now is a hand-built SVG mockup, not
a real capture. To replace one:

1. Record the real interaction — any screen recorder works (macOS
   Screenshot app / QuickTime, Windows Snipping Tool, or a
   GIF-focused tool like [Kap](https://getkap.co/) or
   [ScreenToGif](https://www.screentogif.com/) if you want a small,
   loopable file for the README).
2. Export as GIF or MP4 and drop it into `docs/media/`, e.g.
   `docs/media/hero-demo.gif`.
3. Update the corresponding `<img src="...">` in this README to point
   at the new file, and delete the matching `.svg` mockup and its
   "(placeholder mockup)" caption line.

## License

MIT

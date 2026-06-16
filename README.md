# Inline Fold

Extend Markdown capabilities with smart inline folding to create active-recall flashcards, spoilers, and custom aliases inside your Obsidian notes.

---

## Core Features & Behavior Showcase

### 1. Solving the Abstraction vs. Detail Trade-off
Traditional note-taking forces you to choose between clean, high-level summaries and dense, messy details. Inline Fold lets you preserve both in a unified view.

<img width="640" height="619" alt="inline fold demo 1" src="https://github.com/user-attachments/assets/cbf18941-e324-4d72-b09e-3921a49a510c" />

### 2. Embed Details Anywhere While Keeping It Clean
Encapsulate complex data, side-notes, or contextual answers right in the middle of your sentences without breaking your visual reading flow.

<img width="640" height="251" alt="inline fold demo 2" src="https://github.com/user-attachments/assets/57b510c3-69e0-43ed-992c-74d6e0dbcce7" />

### 3. Customizable to the Core
Unlock fine-grained aesthetic control. Take advantage of built-in archetype themes (Pill, Ghost, Bracket) or craft your own look by modifying borders, padding, fonts, and colors directly from the micro-settings panel.

<img width="640" height="347" alt="inline fold demo 4" src="https://github.com/user-attachments/assets/05389a6e-e5a8-48f4-8c5b-8ad24d46af37" />

### 4. Infinite Workflow Possibilities
You are limited only by your imagination. Go beyond standard active-recall flashcards and use inline folding to build structured code spoilers, hidden translation keys, nested lists, or multi-language learning vaults.

<img width="640" height="213" alt="inline fold demo 3" src="https://github.com/user-attachments/assets/35cb7e1b-411c-4eba-bf3e-2b79020f14d2" />

---

## How to Use (Syntax)

The plugin scans your notes and builds interactive widgets based on your delimiter configuration.

### Basic Flashcard Mode (Default)
To hide an answer or text block, wrap it in your active class symbols:
The capital of Egypt is [=Cairo=].

### Dynamic Alias Mode (Pipe Syntax)
To override the default placeholder text with a custom label or question, use the pipe operator:
[=An object-oriented language developed by Microsoft|Click to reveal the language=]

---

## Installation

### Community Plugins (Coming Soon)
1. Open Obsidian Settings.
2. Navigate to Community Plugins -> Browse.
3. Search for Inline Fold and click Install.
4. Enable the plugin.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Move them into your vault's plugin directory: your-vault/.obsidian/plugins/inline-fold/
3. Reload Obsidian and enable the plugin from your settings panel.

---

## Support & Feedback

If this plugin saves you time and keeps your vault clean, you can support its development by:

- Leaving a **Star** on this repository
- Submitting your feature ideas or reporting issues in the Issues tab
- Sharing the plugin with fellow Obsidian power users!

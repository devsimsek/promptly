# promptly context

A single-page teleprompter that runs fully in the browser: scripts stay in
IndexedDB, speech recognition runs on-device through Whisper via
Transformers.js, and nothing else leaves the device.

## Language

**Script**:
The text the presenter reads, stored as one record in the script library.
_Avoid_: document, file

**Token**:
One display word of the script after Markdown stripping; the unit the
prompter highlights. Tokens preserve display spelling (`raw`) and hold a
normalized form (`clean`).
_Avoid_: chunk, element

**Spoken word**:
The normalized form used when matching Whisper output to tokens.
_Avoid_: clean text, transcript word

**Reading pointer**:
The token the presenter should read next; rendered at the focal eye-line.
Also called the current token.
_Avoid_: cursor, caret

**Focal eye-line**:
The horizontal line (top 33 percent by default) where the current token
settles while scrolling.
_Avoid_: center line

**Local window**:
How many upcoming tokens the matcher considers on each transcript batch.
_Avoid_: buffer, reach

**Recovery search**:
Optional search (off, forward, whole script) for a unique phrase after the
matcher loses the presenter.
_Avoid_: global search, resync

**Pause cue**:
A visual separator token created from Markdown rules (`---`, `***`); never
matched against speech.
_Avoid_: break, divider block

**Manual WPM mode**:
Fallback pacing that advances the reading pointer at words per minute.
_Avoid_: auto mode, timer

**Whisper tracking**:
Speech-driven pointer advance inside the local window; requires the model
in a ready state.
_Avoid_: live mode

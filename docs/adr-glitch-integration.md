# ADR: Versioned glitch duels

New duels use server-generated text and markers. Placement uses the base text ID and
`lang:glitch-v1` seed, never player identity or the random session seed. The start
response preserves its fields and adds `glitch: { version, markers }`.

The stored text ID is namespaced as `<base-id>:glitch-v1`. Existing text IDs,
session rows, ghost records, and bot records are never rewritten. The namespace
separates matchmaking pools using the existing text-ID query and gives bots new
session IDs. Bots synthesize keystrokes on the inserted text. Real ghosts must also
match the exact target text and glitch metadata; incompatible candidates fall back
to a labelled bot. Legacy rematches stay on legacy text with legacy rules.

No schema migration or backfill is needed. Deploy the API and web together; the
new ghost pool starts with bots and fills with verified runs. Keep version-one
placement data, passage content, and rules stable. A future glitch version needs
a new namespace and retained readers/rules for earlier versions. An unavailable
version fails submission explicitly instead of silently using legacy rules.

Submission reconstructs markers from the stored text ID, language, and target
text. Client-supplied text, markers, fires, penalties, and scores are ignored.
`simulateDuel` derives fires through `recordGlitchFires`, applies each failed
glitch's self-penalty once, and boosts the attacker's next three text words after
a successful OVERCLOCK. Each boosted word deals `floor(normalDamage * 1.5)`;
stagger still prevents damage. Boosts do not stack. Same-time damage and penalties
resolve together. Records without glitch metadata retain the original simulation.
The live client calls this same simulation, truncated at the replay clock.

Timing and balance data live in `packages/texts/src/glitch.json`: SCRAMBLE 4000 ms,
BLACKOUT 3000 ms, STATIC 5000 ms, OVERCLOCK three words at 1.5, cooldown 8000 ms,
and failure penalty 3 HP. The existing string pool is now JSON in
`packages/texts/src/glitchPool.json`, with its original order preserved.

Incoming ghost fires are consumed once using `glitchFiresBetween`. SCRAMBLE
reverses the next word's visual letters, fixed at the cursor position when hit.
BLACKOUT overlays half the visible window; STATIC adds constant noise and slow
jitter, with no opacity flashing or gameplay change. Effects use half-open time
intervals and remove their classes and visual spans at expiry. Reduced motion
disables jitter, obscuring, and shuffled letters while retaining effect labels.
The real text remains the stream's accessible label. OVERCLOCK highlights the
player's three boosted words and reports the ghost's remaining boosted words as
an incoming warning. Feedback is polite, and incoming effects use the existing
glitch sound. Successful fires emit `glitch_fired` with source `duel`.

Tests cover deterministic placement/fires, cooldown, exact expiry, self-penalties,
legacy outcomes, untrusted submission metadata, compatible matchmaking, replay,
reduced motion, accessible text, and live/server HP agreement. The separate
full-glitch E2E placeholder remains intentionally unchanged.

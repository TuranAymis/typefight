import { useEffect, useMemo, useRef, useState } from 'react';
import {
  activeGlitches,
  computeComboTimeline,
  RECORD_VERSION,
  glitchFiresBetween,
  overclockWordIndices,
  sessionGlitchFires,
  type KeyEvent,
  type SessionRecord,
} from '@typefight/engine';
import { playSound } from '../audio';
import { track } from '../analytics';
import type { DuelStart } from './duelApi';
import { ghostPosition } from './duelLive';

export const useDuelGlitches = (duel: DuelStart, events: readonly KeyEvent[], elapsed: number) => {
  const player = useMemo(
    (): SessionRecord => ({
      version: RECORD_VERSION,
      targetText: duel.text,
      locale: duel.lang,
      events: events.filter((event) => event.t <= elapsed),
      durationMs: elapsed,
      ...(duel.glitch ? { glitch: duel.glitch } : {}),
    }),
    [duel, events, elapsed],
  );
  const ghostFires = useMemo(() => sessionGlitchFires(duel.opponent.record), [duel]);
  const playerFires = useMemo(() => sessionGlitchFires(player), [player]);
  const previous = useRef(-1);
  const seenPlayer = useRef(new Set<number>());
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    const messages: string[] = [];
    for (const fire of glitchFiresBetween(ghostFires, previous.current, elapsed)) {
      playSound('glitch');
      track('glitch_fired', { source: 'duel' });
      messages.push(`${fire.effect.toUpperCase()} glitch hit you`);
    }
    previous.current = elapsed;
    for (const fire of playerFires) {
      if (seenPlayer.current.has(fire.glitchId)) continue;
      seenPlayer.current.add(fire.glitchId);
      if (fire.outcome === 'fired') {
        track('glitch_fired', { source: 'duel' });
        messages.push(`${fire.effect.toUpperCase()} glitch sent`);
      } else if (fire.outcome === 'failed') messages.push(`Glitch penalty: -${fire.penalty} HP`);
    }
    if (messages.length) setFeedback(messages.join('. '));
  }, [elapsed, ghostFires, playerFires]);

  const active = activeGlitches(ghostFires, elapsed);
  const scramble = active.find((entry) => entry.fire.effect === 'scramble');
  const atHit = scramble ? ghostPosition(player, scramble.fire.t).cursor : -1;
  const nextStart = atHit < 0 ? -1 : duel.text.indexOf(' ', atHit) + 1;
  const end = nextStart > 0 ? duel.text.indexOf(' ', nextStart) : -1;
  const nextEnd = end < 0 ? duel.text.length : end;
  const scrambled =
    nextStart > 0 ? [...duel.text.slice(nextStart, nextEnd)].reverse().join('') : '';
  const ghost = {
    ...duel.opponent.record,
    events: duel.opponent.record.events.filter((event) => event.t <= elapsed),
  };
  const remainingBoosts = (record: SessionRecord) => {
    const completed = new Set(
      computeComboTimeline(record).events.flatMap((event) =>
        event.type === 'word' ? [event.wordIndex] : [],
      ),
    );
    return overclockWordIndices(record).filter((index) => !completed.has(index));
  };
  const incomingWords = remainingBoosts(ghost).length;
  return {
    active,
    feedback,
    nextStart,
    nextEnd,
    scrambled,
    boosted: remainingBoosts(player),
    incomingWords,
  };
};

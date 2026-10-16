import type { SoundEvent } from '@typefight/texts';
import { useSoundStore } from '../store/useSoundStore';
import { createSoundPlayer, type AudioContextLike } from './soundPlayer';

const player = createSoundPlayer(
  () =>
    typeof AudioContext === 'undefined'
      ? null
      : (new AudioContext() as unknown as AudioContextLike),
  () => useSoundStore.getState().muted,
);

/** Plays a game sound unless the player muted sound. Safe to call from anywhere, any time. */
export const playSound = (event: SoundEvent): void => player.play(event);

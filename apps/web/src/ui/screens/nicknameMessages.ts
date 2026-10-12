import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@typefight/texts';
import type { IdentityError } from '../../store/useIdentityStore';

export const NICKNAME_MESSAGES: Record<IdentityError, string> = {
  too_short: `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters.`,
  too_long: `Nickname can be at most ${NICKNAME_MAX_LENGTH} characters.`,
  invalid_chars: 'Use only letters, digits, "_" and "-" (no spaces).',
  profanity: 'That nickname is not allowed. Please pick another one.',
  network: 'Cannot reach the server. Check your connection and try again.',
  server: 'Something went wrong on our side. Please try again.',
  storage: 'Your browser blocked saving the profile. Allow site storage and try again.',
};

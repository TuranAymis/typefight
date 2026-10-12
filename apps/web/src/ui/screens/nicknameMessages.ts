import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@typefight/texts';
import type { IdentityError, RecoverError } from '../../store/useIdentityStore';

export const NICKNAME_MESSAGES: Record<IdentityError, string> = {
  too_short: `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters.`,
  too_long: `Nickname can be at most ${NICKNAME_MAX_LENGTH} characters.`,
  invalid_chars: 'Use only letters, digits, "_" and "-" (no spaces).',
  profanity: 'That nickname is not allowed. Please pick another one.',
  network: 'Cannot reach the server. Check your connection and try again.',
  server: 'Something went wrong on our side. Please try again.',
  storage: 'Your browser blocked saving the profile. Allow site storage and try again.',
};

export const RECOVER_MESSAGES: Record<RecoverError, string> = {
  invalid_code: 'That code is not valid or was already used.',
  rate_limited: 'Too many attempts. Try again in a few minutes.',
  network: 'Could not reach the server. Check your connection.',
  server: 'Something went wrong. Try again.',
  storage: 'Could not save the profile in this browser.',
};

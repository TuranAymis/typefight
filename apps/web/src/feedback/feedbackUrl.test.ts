import { describe, expect, it } from 'vitest';
import { feedbackUrlFor, parseFeedbackUrl } from './feedbackUrl';

describe('parseFeedbackUrl', () => {
  it('accepts an https address', () => {
    expect(parseFeedbackUrl('https://forms.example/typefight')).toBe(
      'https://forms.example/typefight',
    );
    expect(parseFeedbackUrl('  https://forms.example/a?b=1  ')).toBe('https://forms.example/a?b=1');
  });

  it('returns nothing when it is not set', () => {
    expect(parseFeedbackUrl(undefined)).toBeNull();
    expect(parseFeedbackUrl('')).toBeNull();
    expect(parseFeedbackUrl('   ')).toBeNull();
  });

  it('refuses anything that is not a plain https address', () => {
    for (const bad of [
      'http://forms.example',
      'javascript:alert(1)',
      'mailto:someone@example.com',
      'data:text/html,hi',
      'forms.example/typefight',
      'not a url',
    ])
      expect(parseFeedbackUrl(bad), bad).toBeNull();
  });
});

describe('feedbackUrlFor', () => {
  it('hides the link in the portal build', () => {
    expect(feedbackUrlFor('https://forms.example', true)).toBeNull();
    expect(feedbackUrlFor('https://forms.example', false)).toBe('https://forms.example/');
  });
});

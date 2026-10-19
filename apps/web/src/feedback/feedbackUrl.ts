/**
 * The one-click feedback link. The address comes from the build (VITE_FEEDBACK_URL), so the form or
 * issue tracker can change without a code change. It must be an https address: anything else
 * (javascript:, mailto:, a typo) is ignored and the link simply does not show.
 */
export const parseFeedbackUrl = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Whether the link may show: not on the portal build, where outside links are not allowed. */
export const feedbackUrlFor = (raw: string | undefined, portalBuild: boolean): string | null =>
  portalBuild ? null : parseFeedbackUrl(raw);

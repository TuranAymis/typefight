import { IS_CRAZYGAMES_BUILD } from '../portal';
import styles from '../ui/App.module.css';
import { feedbackUrlFor } from './feedbackUrl';

const feedbackUrl = feedbackUrlFor(import.meta.env.VITE_FEEDBACK_URL, IS_CRAZYGAMES_BUILD);

/** One click from any screen to the feedback form; nothing is sent from the game itself. */
export const FeedbackLink = () =>
  feedbackUrl ? (
    <a
      id="feedback-link"
      className={styles.feedbackLink}
      href={feedbackUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      Send feedback
    </a>
  ) : null;

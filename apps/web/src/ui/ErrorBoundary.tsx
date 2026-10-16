import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useAppStore } from '../store';
import styles from './ErrorBoundary.module.css';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

/** What the player sees instead of a blank page when a screen crashes while rendering. */
export const ErrorFallback = ({ onMenu }: { readonly onMenu: () => void }) => (
  <div className={styles.fallback} id="screen-error" role="alert">
    <h1 className={styles.title}>Something broke</h1>
    <p className={styles.text}>This screen hit an unexpected error. Your progress is safe.</p>
    <div className={styles.actions}>
      <button id="error-menu" className={styles.primary} onClick={onMenu}>
        Back to menu
      </button>
      <button id="error-reload" className={styles.secondary} onClick={() => location.reload()}>
        Reload page
      </button>
    </div>
  </div>
);

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Screen crashed', error, info.componentStack);
  }

  private readonly backToMenu = (): void => {
    useAppStore.getState().setScreen('menu');
    this.setState({ failed: false });
  };

  override render(): ReactNode {
    return this.state.failed ? <ErrorFallback onMenu={this.backToMenu} /> : this.props.children;
  }
}

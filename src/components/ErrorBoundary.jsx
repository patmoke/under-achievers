import { Component } from 'react';
import CrashScreen from './CrashScreen';
import { reportError } from '../lib/monitoring';

/**
 * Catches a render that throws, so the app shows something rather than a
 * white screen.
 *
 * A class because React offers no hook equivalent — componentDidCatch is the
 * only way to catch a descendant's render error.
 */
export default class ErrorBoundary extends Component {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    // The component stack is worth more than the JS stack here: it names the
    // component that blew up, where a minified trace names a mangled function.
    reportError(
      Object.assign(error, {
        stack: `${error.stack || error.message}\n--- component stack ---${info?.componentStack || ''}`,
      }),
      'render'
    );
  }

  reset = () => this.setState({ crashed: false });

  render() {
    if (this.state.crashed) return <CrashScreen resetError={this.reset} />;
    return this.props.children;
  }
}

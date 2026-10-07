import { useCallback, useRef, useState } from 'react';

// Guards a form's submit handler against double clicks and exposes which action
// is running, so its button can show a spinner.
//   const [busyAction, withBusy] = useBusyAction();
//   <form onSubmit={withBusy('grn', handleGrnSubmit)}>
//   <LoadingButton type="submit" loading={busyAction === 'grn'}>
export default function useBusyAction() {
  const [busyAction, setBusyAction] = useState('');
  const running = useRef(false);

  const withBusy = useCallback((key, handler) => async (...args) => {
    if (running.current) {
      // Still stop the browser's default form submit for the ignored click.
      if (args[0] && typeof args[0].preventDefault === 'function') args[0].preventDefault();
      return;
    }
    running.current = true;
    setBusyAction(key);
    try {
      await handler(...args);
    } finally {
      running.current = false;
      setBusyAction('');
    }
  }, []);

  return [busyAction, withBusy];
}

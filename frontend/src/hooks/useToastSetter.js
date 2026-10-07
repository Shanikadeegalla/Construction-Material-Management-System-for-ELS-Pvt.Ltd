import { useCallback, useRef } from 'react';
import { useToast } from '../context/ToastContext';

const ICON_PREFIX = /^(?:✅|❌|⚠️|⚠)\s*/u;
const ERROR_WORDS = /fail|error|invalid|cannot|can't|could not|unable|required|please|must|not found|denied|exceed/i;

// Wraps a page's message setter (setError / setSuccess / setMessage) so every
// message it shows in the page is also raised as a toast. The page keeps using
// the setter exactly as before.
//   type: 'error' | 'success' | 'auto' ('auto' reads the ✅ / ❌ prefix or wording)
export default function useToastSetter(setState, type = 'auto') {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const last = useRef({ text: '', lastText: '', at: 0 });

  return useCallback((value) => {
    setState(value);
    if (typeof value !== 'string' || !value.trim()) {
      // Cleared: the same message may be shown again by the next action.
      last.current = { ...last.current, text: '' };
      return;
    }
    const now = Date.now();
    // A background refresh can set the same message repeatedly; show it once.
    if (last.current.text === value || (last.current.lastText === value && now - last.current.at < 2000)) return;
    last.current = { text: value, lastText: value, at: now };

    const text = value.replace(ICON_PREFIX, '');
    let kind = type;
    if (kind === 'auto') {
      if (value.startsWith('❌')) kind = 'error';
      else if (value.startsWith('⚠')) kind = 'warning';
      else if (value.startsWith('✅')) kind = 'success';
      else kind = ERROR_WORDS.test(value) ? 'error' : 'success';
    }
    (toastRef.current[kind] || toastRef.current.info)(text);
  }, [setState, type]);
}

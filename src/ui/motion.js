// Small helpers for motion and touch feedback. All of them respect "reduce motion".
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts from 0 to the value on first show, then follows changes without animation.
export function useCountUp(value, duration = 600) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  const done = useRef(false);
  useEffect(() => {
    if (done.current || reducedMotion() || !value) {
      setShown(value);
      return;
    }
    done.current = true;
    const start = performance.now();
    let frame;
    const step = time => {
      const progress = Math.min(1, (time - start) / duration);
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

// A tiny vibration on phones that support it.
export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not supported: nothing to do.
  }
}

// Runs a state change as a smooth cross-fade where the browser supports it.
export function smoothly(change) {
  if (!document.startViewTransition || reducedMotion()) return change();
  document.startViewTransition(() => flushSync(change));
}

import { useCallback, useEffect, useRef, useState } from "react";

type StateUpdate<T> = T | ((previous: T) => T);

const applyStateUpdates = <T>(base: T, updates: StateUpdate<T>[]) =>
  updates.reduce<T>((current, update) => {
    if (typeof update === "function") {
      return (update as (previous: T) => T)(current);
    }
    return update;
  }, base);

export const useAnimationFrameState = <T>(initialValue: T) => {
  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(value);
  const pendingUpdatesRef = useRef<StateUpdate<T>[]>([]);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const flush = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pendingUpdatesRef.current.length === 0) {
      return valueRef.current;
    }
    const nextValue = applyStateUpdates(valueRef.current, pendingUpdatesRef.current);
    pendingUpdatesRef.current = [];
    valueRef.current = nextValue;
    setValue((current) => (Object.is(current, nextValue) ? current : nextValue));
    return nextValue;
  }, []);

  const schedule = useCallback(
    (update: StateUpdate<T>) => {
      pendingUpdatesRef.current.push(update);
      if (typeof window === "undefined") {
        return flush();
      }
      if (frameRef.current !== null) {
        return valueRef.current;
      }
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        if (pendingUpdatesRef.current.length === 0) return;
        const nextValue = applyStateUpdates(valueRef.current, pendingUpdatesRef.current);
        pendingUpdatesRef.current = [];
        valueRef.current = nextValue;
        setValue((current) => (Object.is(current, nextValue) ? current : nextValue));
      });
      return valueRef.current;
    },
    [flush]
  );

  const setImmediate = useCallback((update: StateUpdate<T>) => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingUpdatesRef.current = [];
    const nextValue = applyStateUpdates(valueRef.current, [update]);
    valueRef.current = nextValue;
    setValue((current) => (Object.is(current, nextValue) ? current : nextValue));
    return nextValue;
  }, []);

  const clearPending = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingUpdatesRef.current = [];
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  return {
    value,
    ref: valueRef,
    schedule,
    setImmediate,
    flush,
    clearPending,
  };
};

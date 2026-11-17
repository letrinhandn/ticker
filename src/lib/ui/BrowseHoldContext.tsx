"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BrowseHoldApi = {
  /** True while the user has any browse card open. */
  hold: boolean;
  /** Register an open browse view; returns release. */
  acquire: () => () => void;
};

const BrowseHoldContext = createContext<BrowseHoldApi>({
  hold: false,
  acquire: () => () => {},
});

/**
 * Tracks user-opened cards (deed / portfolio / sector / deck browser)
 * so turn FX can keep running behind without yanking the view closed.
 */
export function BrowseHoldProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const acquire = useCallback(() => {
    setCount((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setCount((n) => Math.max(0, n - 1));
    };
  }, []);

  const value = useMemo(
    () => ({ hold: count > 0, acquire }),
    [count, acquire],
  );

  return (
    <BrowseHoldContext.Provider value={value}>
      {children}
    </BrowseHoldContext.Provider>
  );
}

export function useBrowseHold() {
  return useContext(BrowseHoldContext);
}

/** Keep `active` registered as a browse hold while true. */
export function useBrowseHoldActive(active: boolean) {
  const { acquire } = useBrowseHold();
  useEffect(() => {
    if (!active) return;
    return acquire();
  }, [active, acquire]);
}

"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

type NewLogsContextValue = {
  isNew: (logId: string) => boolean;
  unseenCount: number;
  markSeen: (logId: string) => void;
  markRead: (logIds: string[]) => void;
  markUnread: (logIds: string[]) => void;
};

const NewLogsContext = createContext<NewLogsContextValue | null>(null);

// A minimal external store over sessionStorage. useSyncExternalStore (not
// useState+useEffect) is what makes this hydration-safe: sessionStorage
// only exists in the browser, so the server has no way to know what's
// already been dismissed. getServerSnapshot below always reports "nothing
// overridden yet", which is also what React uses for the client's first
// render during hydration, so server and client agree at that point by
// construction; the real, possibly-different value is only read — and
// only then triggers a re-render — after hydration has already committed.
//
// The store holds a single overrides map (logId -> unread/read), rather
// than a plain "dismissed" set, so the same mechanism can represent both
// the automatic "seen" dismissal (false) and an explicit "mark unread"
// bulk action (true) on any log, not just today's newly-recorded ones.
const listeners = new Set<() => void>();
function emitChange() {
  for (const listener of listeners) listener();
}
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
function getServerSnapshot(): string {
  return "{}";
}

// Tracks which of today's newly-recorded logs the current viewer has
// already opened, so the sidebar badge count and the table's highlight
// stay in sync and both clear together as each log is acknowledged.
// Scoped to sessionStorage (per browser tab, per farm, per day) rather
// than a database column — this is view-state for the person currently
// looking at the screen, not data the product needs to persist or sync
// across devices.
export function NewLogsProvider({
  newLogIds,
  knownLogIds,
  storageKey,
  children,
}: {
  newLogIds: string[];
  // Every log id currently visible to this viewer, server-fetched fresh on
  // each navigation. A manual "mark unread" override only counts toward the
  // badge/highlight while its id is still in here — once a log is deleted
  // (or otherwise falls out of view), its leftover sessionStorage entry is
  // simply ignored instead of inflating the count forever.
  knownLogIds: string[];
  storageKey: string;
  children: React.ReactNode;
}) {
  // Raw JSON string, not a parsed object: strings compare by value (unlike
  // objects/arrays), so this snapshot is naturally stable across calls
  // with no extra memoization required for useSyncExternalStore.
  const getSnapshot = () => {
    try {
      return window.sessionStorage.getItem(storageKey) ?? "{}";
    } catch {
      return "{}";
    }
  };

  const rawOverrides = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const overrides = useMemo<Record<string, boolean>>(() => {
    try {
      return JSON.parse(rawOverrides);
    } catch {
      return {};
    }
  }, [rawOverrides]);

  const writeOverrides = (next: Record<string, boolean>) => {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // sessionStorage can be unavailable (private mode, quota) — the
      // change just won't persist in that case.
    }
    emitChange();
  };

  const markSeen = (logId: string) => {
    if (overrides[logId] === false) return;
    writeOverrides({ ...overrides, [logId]: false });
  };

  const markRead = (logIds: string[]) => {
    const next = { ...overrides };
    for (const id of logIds) next[id] = false;
    writeOverrides(next);
  };

  const markUnread = (logIds: string[]) => {
    const next = { ...overrides };
    for (const id of logIds) next[id] = true;
    writeOverrides(next);
  };

  const value = useMemo<NewLogsContextValue>(() => {
    const known = new Set(knownLogIds);
    const unreadIds = new Set<string>();
    for (const id of newLogIds) {
      if (overrides[id] !== false) unreadIds.add(id);
    }
    for (const [id, unread] of Object.entries(overrides)) {
      if (unread && known.has(id)) unreadIds.add(id);
    }
    return {
      isNew: (logId: string) => unreadIds.has(logId),
      unseenCount: unreadIds.size,
      markSeen,
      markRead,
      markUnread,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newLogIds, knownLogIds, overrides]);

  return <NewLogsContext.Provider value={value}>{children}</NewLogsContext.Provider>;
}

// Safe outside the provider (e.g. if a component using this is ever
// rendered in a context without it) — behaves as "nothing is new".
export function useNewLogs(): NewLogsContextValue {
  return (
    useContext(NewLogsContext) ?? {
      isNew: () => false,
      unseenCount: 0,
      markSeen: () => {},
      markRead: () => {},
      markUnread: () => {},
    }
  );
}

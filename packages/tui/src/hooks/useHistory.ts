import { useState, useCallback, useRef, useEffect } from 'react';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getGlobalHistoryPath, getGlobalConfigDir } from '@cod/config';

export function useHistory(maxSize = 1000) {
  const [history, setHistory] = useState<string[]>([]);
  // Use a ref for the cursor so navigateUp/navigateDown return values are
  // always consistent — React state updates are async but the return value
  // from navigate* must reflect the action taken in the same call.
  const indexRef = useRef(-1);
  const historyRef = useRef<string[]>([]);
  const historyPath = getGlobalHistoryPath();

  useEffect(() => {
    void loadHistory();
  }, []);

  // Keep historyRef in sync with state so callbacks don't stale-close over it
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const loadHistory = async () => {
    if (!existsSync(historyPath)) return;
    try {
      const content = await readFile(historyPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      setHistory(lines);
      historyRef.current = lines;
    } catch {
      // Ignore
    }
  };

  const saveHistory = async (lines: string[]) => {
    try {
      await mkdir(getGlobalConfigDir(), { recursive: true });
      await writeFile(historyPath, lines.join('\n'), 'utf8');
    } catch {
      // Ignore
    }
  };

  const add = useCallback(
    (entry: string) => {
      if (!entry.trim()) return;
      setHistory((prev) => {
        const deduplicated = prev.filter((e) => e !== entry);
        const newHistory = [...deduplicated, entry].slice(-maxSize);
        historyRef.current = newHistory;
        void saveHistory(newHistory);
        return newHistory;
      });
      indexRef.current = -1;
    },
    [maxSize],
  );

  const navigateUp = useCallback((): string | undefined => {
    const h = historyRef.current;
    if (h.length === 0) return undefined;
    const current = indexRef.current;
    const newIndex = current === -1 ? h.length - 1 : Math.max(0, current - 1);
    indexRef.current = newIndex;
    return h[newIndex];
  }, []);

  const navigateDown = useCallback((): string | undefined => {
    const h = historyRef.current;
    const current = indexRef.current;
    if (current === -1) return undefined;
    const newIndex = current + 1;
    if (newIndex >= h.length) {
      indexRef.current = -1;
      return undefined;
    }
    indexRef.current = newIndex;
    return h[newIndex];
  }, []);

  const reset = useCallback(() => {
    indexRef.current = -1;
  }, []);

  return { history, add, navigateUp, navigateDown, reset };
}

import { useState, useCallback, useRef, useEffect } from 'react';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getGlobalHistoryPath, getGlobalConfigDir } from '@cod/config';

export function useHistory(maxSize = 1000) {
  const [history, setHistory] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);
  const historyPath = getGlobalHistoryPath();

  useEffect(() => {
    // Load history from disk on mount
    void loadHistory();
  }, []);

  const loadHistory = async () => {
    if (!existsSync(historyPath)) return;
    try {
      const content = await readFile(historyPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      setHistory(lines);
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
        void saveHistory(newHistory);
        return newHistory;
      });
      setIndex(-1);
    },
    [maxSize],
  );

  const navigateUp = useCallback((): string | undefined => {
    setIndex((prev) => {
      const newIndex = prev === -1 ? history.length - 1 : Math.max(0, prev - 1);
      return newIndex;
    });
    return history[index === -1 ? history.length - 1 : Math.max(0, index - 1)];
  }, [history, index]);

  const navigateDown = useCallback((): string | undefined => {
    if (index === -1) return undefined;
    const newIndex = index + 1;
    if (newIndex >= history.length) {
      setIndex(-1);
      return undefined;
    }
    setIndex(newIndex);
    return history[newIndex];
  }, [history, index]);

  const reset = useCallback(() => setIndex(-1), []);

  return { history, add, navigateUp, navigateDown, reset };
}

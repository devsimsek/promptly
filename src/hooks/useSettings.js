// UI settings state backed by localStorage (see utils/settings.js).

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../utils/settings.js";

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const update = useCallback((patch) => {
    setSettings((current) => saveSettings({ ...current, ...patch }));
  }, []);

  return { settings, update, defaults: DEFAULT_SETTINGS };
}

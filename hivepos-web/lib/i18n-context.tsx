"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { type Lang, getTranslation } from "@/lib/i18n";

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("lang");
      if (stored === "en" || stored === "id") {
        setLangState(stored);
      }
    } catch {}
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try {
      localStorage.setItem("lang", newLang);
    } catch {}
    document.cookie = `lang=${newLang};path=/;max-age=31536000`;
  }, []);

  const t = useCallback(
    (key: string) => getTranslation(lang, key),
    [lang]
  );

  // ponytail: memoize context value — lang is the only dep that changes (locale switch).
  // Without this, every consumer of useTranslation re-renders on every parent render.
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

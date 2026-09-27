import { createContext, lazy, Suspense, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

const EnglishTextTranslationBridge = lazy(() => import("./legacyTranslations").then((module) => ({
  default: module.LegacyTextTranslationBridge,
})));

export type AppLocale = "zh-CN" | "en";

export const APP_LOCALE_PREFERENCE_KEY = "dsp-idle-network.locale.v1";

function localeFromQuery(): AppLocale | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("lang");
  return requested === "en" ? "en" : requested === "zh" || requested === "zh-CN" ? "zh-CN" : null;
}

function initialLocale(): AppLocale {
  const requested = localeFromQuery();
  if (requested) return requested;
  try {
    return window.localStorage.getItem(APP_LOCALE_PREFERENCE_KEY) === "en" ? "en" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

export function applyDocumentLocale(locale: AppLocale): void {
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  // 名称以 package.json displayName / displayNameEn（构建期注入常量）为唯一来源。
  document.title = locale === "en" ? __APP_DISPLAY_NAME_EN__ : __APP_DISPLAY_NAME__;
}

export function initializeDocumentLocale(): void {
  if (typeof window !== "undefined") applyDocumentLocale(initialLocale());
}

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  isEnglish: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function AppLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);
  useLayoutEffect(() => {
    applyDocumentLocale(locale);
    try { window.localStorage.setItem(APP_LOCALE_PREFERENCE_KEY, locale); } catch { /* Device preference is best-effort. */ }
  }, [locale]);
  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    const url = new URL(window.location.href);
    if (next === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const value = useMemo(() => ({ locale, setLocale, isEnglish: locale === "en" }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>
    {locale === "en" ? <Suspense fallback={null}><EnglishTextTranslationBridge locale="en" /></Suspense> : null}
    {children}
  </LocaleContext.Provider>;
}

export function useAppLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useAppLocale must be used inside AppLocaleProvider");
  return context;
}

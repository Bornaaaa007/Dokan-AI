'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { T } from '../lib/i18n';

const Ctx = createContext({ t: T.en, lang: 'en', toggle: () => {} });
export const useLang = () => useContext(Ctx);

export function LangProvider({ children }) {
  const [lang, setLang] = useState('en');
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <Ctx.Provider value={{ t: T[lang], lang, toggle: () => setLang(l => (l === 'en' ? 'bn' : 'en')) }}>{children}</Ctx.Provider>;
}

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

type Language = 'en' | 'zh';

const translations: Record<Language, Record<string, string>> = { en, zh };

interface TranslationContextType {
  t: (key: string, replacements?: Record<string, string>) => string;
  lang: Language;
  setLanguage: (lang: Language) => Promise<void>;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const STORAGE_KEY = 'language';
const DEFAULT_LANG: Language = 'en';

export const TranslationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(DEFAULT_LANG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'zh') {
        setLang(stored);
      }
    });
  }, []);

  const t = useCallback(
    (key: string, replacements?: Record<string, string>): string => {
      let value = translations[lang]?.[key] || translations['en']?.[key] || key;
      if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
          value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        });
      }
      return value;
    },
    [lang]
  );

  const setLanguage = useCallback(async (newLang: Language) => {
    setLang(newLang);
    await AsyncStorage.setItem(STORAGE_KEY, newLang);
  }, []);

  return (
    <TranslationContext.Provider value={{ t, lang, setLanguage }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = (): TranslationContextType => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

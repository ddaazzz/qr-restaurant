import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations, LanguageCode } from '../locales/translations';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../services/apiClient';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, defaultValue?: string) => string;
  restaurantId: string | null;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Load language and restaurant preference on mount
  useEffect(() => {
    loadLanguagePreference();
  }, []);

  // Load language from storage and database
  const loadLanguagePreference = async () => {
    try {
      // First try to get from local storage
      const savedLang = await SecureStore.getItemAsync('language');
      if (savedLang && (savedLang === 'en' || savedLang === 'zh')) {
        setLanguageState(savedLang as LanguageCode);
      }

      // Try to get restaurant ID
      const rid = await SecureStore.getItemAsync('restaurantId');
      setRestaurantId(rid);

      // If we have a restaurant ID, get language preference from database
      if (rid) {
        try {
          const response = await apiClient.get(`/api/restaurants/${rid}/settings`);
          if (response.data?.language_preference) {
            const dbLang = response.data.language_preference as LanguageCode;
            if (dbLang === 'en' || dbLang === 'zh') {
              setLanguageState(dbLang);
              // Save to local storage
              await SecureStore.setItemAsync('language', dbLang);
            }
          }
        } catch (error) {
          console.log('[LanguageProvider] Could not fetch language from database:', error);
        }
      }
    } catch (error) {
      console.warn('[LanguageProvider] Error loading language preference:', error);
    }
  };

  // Handle language change
  const setLanguage = async (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      // Save to local storage
      await SecureStore.setItemAsync('language', lang);

      // Update database if we have restaurant ID
      if (restaurantId) {
        try {
          await apiClient.patch(`/api/restaurants/${restaurantId}/settings`, {
            language_preference: lang,
          });
        } catch (error) {
          console.warn('[LanguageProvider] Could not update language in database:', error);
        }
      }
    } catch (error) {
      console.warn('[LanguageProvider] Error saving language preference:', error);
    }
  };

  // Translation function
  const t = (key: string, defaultValue: string = key): string => {
    const translation = translations[language]?.[key];
    return translation || defaultValue;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, restaurantId }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

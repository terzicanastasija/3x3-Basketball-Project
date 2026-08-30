import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import srCommon from "./locales/sr/common.json";
import enCommon from "./locales/en/common.json";

// Serbian ships first; English is scaffolded now (even if untranslated in places) so adding
// full English later is a translation-fill task, not a refactor.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      sr: { common: srCommon },
      en: { common: enCommon },
    },
    fallbackLng: "sr",
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;

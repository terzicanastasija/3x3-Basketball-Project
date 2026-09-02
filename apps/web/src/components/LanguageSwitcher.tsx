import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "sr", label: "SR" },
  { code: "en", label: "EN" },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="lang-switch">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={i18n.resolvedLanguage === code ? "lang-switch__btn lang-switch__btn--active" : "lang-switch__btn"}
          onClick={() => void i18n.changeLanguage(code)}
          disabled={i18n.resolvedLanguage === code}
          aria-current={i18n.resolvedLanguage === code}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

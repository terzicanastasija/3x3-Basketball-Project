import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "sr", label: "SR" },
  { code: "en", label: "EN" },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => void i18n.changeLanguage(code)}
          disabled={i18n.resolvedLanguage === code}
          aria-current={i18n.resolvedLanguage === code}
          style={{
            fontWeight: i18n.resolvedLanguage === code ? 700 : 400,
            cursor: i18n.resolvedLanguage === code ? "default" : "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

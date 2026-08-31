import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function NavBar() {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link to="/">{t("nav.home")}</Link>
        <Link to="/clubs">{t("nav.clubs")}</Link>
        <Link to="/players">{t("nav.players")}</Link>
        <Link to="/tournaments">{t("nav.tournaments")}</Link>
        <Link to="/compilations">{t("nav.compilations")}</Link>
      </nav>
      <LanguageSwitcher />
    </div>
  );
}

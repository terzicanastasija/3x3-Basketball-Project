import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useCurrentUser } from "../features/auth/api";

export function NavBar() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const canTag = currentUser?.isSuperadmin || currentUser?.isScout;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link to="/">{t("nav.home")}</Link>
        <Link to="/clubs">{t("nav.clubs")}</Link>
        <Link to="/players">{t("nav.players")}</Link>
        <Link to="/tournaments">{t("nav.tournaments")}</Link>
        {canTag && <Link to="/tag">{t("nav.tagMatch")}</Link>}
        <Link to="/compilations">{t("nav.compilations")}</Link>
      </nav>
      <LanguageSwitcher />
    </div>
  );
}

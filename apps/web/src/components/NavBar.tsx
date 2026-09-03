import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useCurrentUser, useLogout } from "../features/auth/api";

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "app-nav__link app-nav__link--active" : "app-nav__link";
}

export function NavBar() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const logout = useLogout();
  const canTag = currentUser?.isSuperadmin || currentUser?.isScout;

  return (
    <header className="app-nav">
      <NavLink to="/" end className="app-nav__brand">
        <span className="app-nav__mark">
          3<em>x</em>3
        </span>
        <span className="app-nav__wordmark">Coach</span>
      </NavLink>

      <nav className="app-nav__links">
        <NavLink to="/" end className={navLinkClassName}>
          {t("nav.home")}
        </NavLink>
        <NavLink to="/clubs" className={navLinkClassName}>
          {t("nav.clubs")}
        </NavLink>
        <NavLink to="/players" className={navLinkClassName}>
          {t("nav.players")}
        </NavLink>
        <NavLink to="/tournaments" className={navLinkClassName}>
          {t("nav.tournaments")}
        </NavLink>
        <NavLink to="/search" className={navLinkClassName}>
          {t("nav.search")}
        </NavLink>
        {canTag && (
          <NavLink to="/tag" className={navLinkClassName}>
            {t("nav.tagMatch")}
          </NavLink>
        )}
        <NavLink to="/compilations" className={navLinkClassName}>
          {t("nav.compilations")}
        </NavLink>
      </nav>

      <div className="app-nav__side">
        <LanguageSwitcher />
        {currentUser && (
          <div className="app-nav__user">
            <span className="app-nav__avatar">{currentUser.firstName.charAt(0)}</span>
            <span className="app-nav__username">{currentUser.firstName}</span>
            <button type="button" className="btn-ghost btn-small" onClick={logout}>
              {t("auth.logout")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

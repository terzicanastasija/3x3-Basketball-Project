import { useTranslation } from "react-i18next";
import { useCurrentUser, useLogout } from "../api";
import { LanguageSwitcher } from "../../../components/LanguageSwitcher";

export function HomePage() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUser();
  const logout = useLogout();

  if (isLoading) return <p>{t("home.loading")}</p>;

  return (
    <div style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <LanguageSwitcher />
      </div>
      <h1>{t("home.welcome", { name: user ? `${user.firstName} ${user.lastName}` : "" })}</h1>
      {user && (
        <ul>
          <li>Email: {user.email}</li>
          <li>Superadmin: {user.isSuperadmin ? "yes" : "no"}</li>
          <li>
            Clubs:{" "}
            {user.memberships.length === 0
              ? "(none)"
              : user.memberships.map((m) => `${m.club.name} (${m.role})`).join(", ")}
          </li>
        </ul>
      )}
      <button onClick={logout}>{t("auth.logout")}</button>
    </div>
  );
}

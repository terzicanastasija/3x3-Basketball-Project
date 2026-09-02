import { useTranslation } from "react-i18next";
import { useCurrentUser } from "../api";
import { NavBar } from "../../../components/NavBar";

export function HomePage() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return <p>{t("home.loading")}</p>;

  return (
    <div className="page">
      <NavBar />
      <h1>{t("home.welcome", { name: user ? `${user.firstName} ${user.lastName}` : "" })}</h1>
      {user && (
        <div className="card">
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
        </div>
      )}
    </div>
  );
}

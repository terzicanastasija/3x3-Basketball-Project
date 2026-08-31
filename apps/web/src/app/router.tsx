import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { HomePage } from "../features/auth/pages/HomePage";
import { ClubsListPage } from "../features/clubs/pages/ClubsListPage";
import { ClubDetailPage } from "../features/clubs/pages/ClubDetailPage";
import { TeamDetailPage } from "../features/teams/pages/TeamDetailPage";
import { PlayersListPage } from "../features/players/pages/PlayersListPage";
import { PlayerDetailPage } from "../features/players/pages/PlayerDetailPage";
import { RequireAuth } from "./RequireAuth";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <HomePage />
      </RequireAuth>
    ),
  },
  {
    path: "/clubs",
    element: (
      <RequireAuth>
        <ClubsListPage />
      </RequireAuth>
    ),
  },
  {
    path: "/clubs/:clubId",
    element: (
      <RequireAuth>
        <ClubDetailPage />
      </RequireAuth>
    ),
  },
  {
    path: "/clubs/:clubId/teams/:teamId",
    element: (
      <RequireAuth>
        <TeamDetailPage />
      </RequireAuth>
    ),
  },
  {
    path: "/players",
    element: (
      <RequireAuth>
        <PlayersListPage />
      </RequireAuth>
    ),
  },
  {
    path: "/players/:playerId",
    element: (
      <RequireAuth>
        <PlayerDetailPage />
      </RequireAuth>
    ),
  },
]);

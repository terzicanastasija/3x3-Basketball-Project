import { Navigate } from "react-router-dom";
import { authStorage } from "../lib/auth-storage";

export function RequireAuth({ children }: { children: React.ReactElement }) {
  if (!authStorage.getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

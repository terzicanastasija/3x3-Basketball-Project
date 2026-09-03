import { Navigate } from "react-router-dom";
import { authStorage } from "../lib/auth-storage";
import { NavBar } from "../components/NavBar";

// Rendered once here rather than inside each page: every page used to mount its own <NavBar />
// inside its own width-constrained `.page`/`.page-narrow`/`.page-wide` wrapper, so the nav's
// own width (and therefore whether its links fit on one row) varied by page — on a 380px
// `.page-narrow` page the links wrapped into what looked like a vertical stack. Hoisting NavBar
// above every page's own container gives it a single, stable width regardless of what any given
// page picks for its own content.
export function RequireAuth({ children }: { children: React.ReactElement }) {
  if (!authStorage.getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      <div className="nav-shell">
        <NavBar />
      </div>
      {children}
    </>
  );
}

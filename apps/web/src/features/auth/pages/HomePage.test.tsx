import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import { authStorage } from "../../../lib/auth-storage";
import "../../../i18n";

function renderHomePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("navigates to /login and clears stored tokens when logging out", async () => {
    authStorage.setTokens("access-token", "refresh-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "u1",
          email: "coach@example.com",
          firstName: "Test",
          lastName: "Coach",
          isSuperadmin: false,
          locale: "en",
          memberships: [],
        }),
        { status: 200 }
      )
    );
    renderHomePage();

    await screen.findByText(/coach@example.com/i);
    await userEvent.click(screen.getByRole("button", { name: /log out|odjavi/i }));

    await waitFor(() => {
      expect(screen.getByText("login page")).toBeTruthy();
    });
    expect(authStorage.getAccessToken()).toBeNull();
  });
});

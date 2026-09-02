import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";
import "../../../i18n";

function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows validation errors instead of submitting when the form is empty", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderLoginPage();

    await userEvent.click(screen.getByRole("button", { name: /log in|prijavi/i }));

    await waitFor(() => {
      expect(document.querySelectorAll("span.field-error").length).toBeGreaterThan(0);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits credentials to the login endpoint on valid input", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "a", refreshToken: "b" }), { status: 200 })
    );
    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/email/i), "coach@example.com");
    await userEvent.type(screen.getByLabelText(/password|lozinka/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /log in|prijavi/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/login"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});

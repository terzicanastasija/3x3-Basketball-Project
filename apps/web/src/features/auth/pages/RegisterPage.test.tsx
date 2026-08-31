import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "./RegisterPage";
import "../../../i18n";

function renderRegisterPage(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a missing-token message when no token is present in the URL", () => {
    renderRegisterPage("/register");

    expect(screen.getByText(/missing invite token|nedostaje token/i)).toBeTruthy();
  });

  it("submits firstName/lastName/password plus the URL token to the accept-invite endpoint", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken: "a", refreshToken: "b" }), { status: 200 })
      );

    renderRegisterPage("/register?token=invite-token-123");

    await userEvent.type(screen.getByLabelText(/first name|ime/i), "New");
    await userEvent.type(screen.getByLabelText(/last name|prezime/i), "Coach");
    await userEvent.type(screen.getByLabelText(/password|lozinka/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /create account|kreiraj nalog/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/auth/invite/accept"),
        expect.objectContaining({ method: "POST" })
      );
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit?.body as string);
    expect(body).toEqual({
      firstName: "New",
      lastName: "Coach",
      password: "hunter2hunter2",
      token: "invite-token-123",
    });
  });
});

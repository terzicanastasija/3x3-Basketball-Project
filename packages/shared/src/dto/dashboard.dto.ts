import { z } from "zod";

// Team dashboards are always tournament-scoped — a team has no CAREER-scope StatSnapshot.
export const teamDashboardQuerySchema = z.object({
  tournamentId: z.string().min(1),
});
export type TeamDashboardQueryDto = z.infer<typeof teamDashboardQuerySchema>;

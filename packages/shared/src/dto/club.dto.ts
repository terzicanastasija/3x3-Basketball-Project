import { z } from "zod";

export const createClubSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1).optional(),
  logoUrl: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(1).optional(),
});
export type CreateClubDto = z.infer<typeof createClubSchema>;

export const updateClubSchema = createClubSchema.partial();
export type UpdateClubDto = z.infer<typeof updateClubSchema>;

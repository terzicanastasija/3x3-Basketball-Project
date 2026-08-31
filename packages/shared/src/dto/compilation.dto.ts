import { z } from "zod";

export const createCompilationSchema = z.object({
  title: z.string().min(1),
  // Order in the array is the compilation's playback order.
  actionTagIds: z.array(z.string().min(1)).min(1),
});
export type CreateCompilationDto = z.infer<typeof createCompilationSchema>;

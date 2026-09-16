import * as z from "zod";

export const LoginFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Password is required." }),
});

export type LoginFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export const SignupFormSchema = z.object({
  farmName: z
    .string()
    .min(2, { error: "Farm name must be at least 2 characters long." })
    .trim(),
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z
    .string()
    .min(8, { error: "Be at least 8 characters long." })
    .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
    .regex(/[0-9]/, { error: "Contain at least one number." })
    .trim(),
});

export type SignupFormState =
  | {
      errors?: {
        farmName?: string[];
        name?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export const ACTIVITY_TYPES = [
  "spraying",
  "fertilizing",
  "planting",
  "irrigating",
  "harvesting",
  "scouting",
  "pruning",
  "soil_work",
  "equipment_maintenance",
] as const;

export const ACTIVITY_LABELS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  spraying: "Spraying",
  fertilizing: "Fertilizing",
  planting: "Planting",
  irrigating: "Irrigation",
  harvesting: "Harvesting",
  scouting: "Scouting",
  pruning: "Pruning",
  soil_work: "Soil Work",
  equipment_maintenance: "Equipment Maintenance",
};

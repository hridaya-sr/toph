import * as z from "zod";

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

export const JoinFarmFormSchema = z.object({
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
  joinCode: z.string().min(1, { error: "Invite code is required." }).trim(),
});

export type JoinFarmFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
        joinCode?: string[];
      };
      message?: string;
    }
  | undefined;

export const ProfileNameSchema = z.object({
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
});

export type ProfileNameState =
  | {
      errors?: {
        name?: string[];
      };
      message?: string;
    }
  | undefined;

export const ShiftFormSchema = z.object({
  employeeId: z.uuid(),
  fieldId: z.uuid().optional().or(z.literal("")),
  // Optional — an unset activity is decided by the employee when they
  // complete the shift instead (see completeShiftAndCreateLog).
  activityType: z.enum(ACTIVITY_TYPES).optional().or(z.literal("")),
  shiftDate: z.string().min(1, { error: "Date is required." }),
  startTime: z.string().min(1, { error: "Start time is required." }),
  endTime: z.string().min(1, { error: "End time is required." }),
});

export type ShiftFormState =
  | {
      errors?: {
        employeeId?: string[];
        fieldId?: string[];
        activityType?: string[];
        shiftDate?: string[];
        startTime?: string[];
        endTime?: string[];
      };
      message?: string;
    }
  | undefined;

export const AnnouncementFormSchema = z.object({
  body: z
    .string()
    .min(1, { error: "Announcement can't be empty." })
    .max(2000, { error: "Keep it under 2000 characters." })
    .trim(),
});

export type AnnouncementFormState =
  | {
      errors?: {
        body?: string[];
      };
      message?: string;
    }
  | undefined;

export const DirectMessageSchema = z.object({
  recipientId: z.uuid(),
  body: z
    .string()
    .min(1, { error: "Message can't be empty." })
    .max(2000, { error: "Keep it under 2000 characters." })
    .trim(),
});

export type DirectMessageState =
  | {
      errors?: {
        recipientId?: string[];
        body?: string[];
      };
      message?: string;
    }
  | undefined;

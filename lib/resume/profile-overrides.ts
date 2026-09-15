import { z } from "zod";
import type { StudentProfile } from "@/lib/validation/schemas";

export const studentIdentityOverrideSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  university: z.string().min(1).max(160).optional(),
  degree: z.string().min(1).max(200).optional(),
  minor: z.string().max(120).optional(),
  graduationDate: z.string().max(80).optional(),
  currentStatus: z.string().max(80).optional(),
});

export type StudentIdentityOverride = z.infer<typeof studentIdentityOverrideSchema>;

export function parseStudentIdentityOverrides(raw: string): StudentIdentityOverride {
  try {
    return studentIdentityOverrideSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function mergeStudentProfile(profile: StudentProfile, overrides: StudentIdentityOverride): StudentProfile {
  return {
    ...profile,
    name: overrides.name ?? profile.name,
    university: overrides.university ?? profile.university,
    degree: overrides.degree ?? profile.degree,
    minor: overrides.minor ?? profile.minor,
    graduationDate: overrides.graduationDate ?? profile.graduationDate,
    currentStatus: overrides.currentStatus ?? profile.currentStatus,
  };
}

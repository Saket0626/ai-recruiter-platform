import { prisma } from "@/lib/db/prisma";
import { identityKey, normalizeEmail, normalizeUrl } from "@/lib/security/email";

export async function upsertProfessor(input: {
  firstName: string;
  lastName: string;
  fullName: string;
  title?: string | null;
  department?: string | null;
  university: string;
  email?: string | null;
  emailSourceUrl?: string | null;
  facultyPageUrl?: string | null;
  labUrl?: string | null;
  personalWebsite?: string | null;
  status: string;
}) {
  const emailNormalized = input.email ? normalizeEmail(input.email) : null;
  const facultyPageUrlNormalized = input.facultyPageUrl ? normalizeUrl(input.facultyPageUrl) : null;
  const key = identityKey({
    emailNormalized,
    facultyPageUrlNormalized,
    university: input.university,
    fullName: input.fullName,
  });

  const existing =
    (emailNormalized
      ? await prisma.professor.findFirst({ where: { emailNormalized } })
      : null) ??
    (facultyPageUrlNormalized
      ? await prisma.professor.findFirst({ where: { facultyPageUrlNormalized } })
      : null) ??
    (await prisma.professor.findFirst({
      where: {
        university: input.university,
        fullName: { equals: input.fullName },
      },
    })) ??
    (await prisma.professor.findUnique({ where: { identityKey: key } }));

  const data = {
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: input.fullName,
    title: input.title,
    department: input.department,
    university: input.university,
    email: input.email,
    emailNormalized,
    emailSourceUrl: input.emailSourceUrl,
    facultyPageUrl: input.facultyPageUrl,
    facultyPageUrlNormalized,
    labUrl: input.labUrl,
    personalWebsite: input.personalWebsite,
    identityKey: existing?.identityKey ?? key,
  };

  if (existing) {
    return prisma.professor.update({ where: { id: existing.id }, data });
  }
  return prisma.professor.create({ data: { ...data, status: input.status } });
}

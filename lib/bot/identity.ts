export const STUDENT_OUTREACH = {
  fullName: "Saket Amanana",
  firstName: "Saket",
  email: "saket.amanana@gmail.com",
  university: "University of Texas at Dallas",
  year: "First-Year Student",
  degree: "Computer Information Systems and Technology",
} as const;

export function studentSignature() {
  return [
    "Sincerely,",
    STUDENT_OUTREACH.fullName,
    `${STUDENT_OUTREACH.university}, ${STUDENT_OUTREACH.year}`,
    STUDENT_OUTREACH.degree,
    STUDENT_OUTREACH.email,
  ].join("\n");
}

export function professorDisplayName(fullName: string) {
  const cleaned = fullName.replace(/^dr\.?\s+/i, "").trim();
  return `Dr. ${cleaned}`;
}

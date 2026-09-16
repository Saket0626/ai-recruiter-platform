export const OUTREACH_DOC_ID = "1BcTIfAE0up163xHGrvpwCyOojvAgYTOjW1-gLXlSf7g";
export const OUTREACH_DOC_URL = `https://docs.google.com/document/d/${OUTREACH_DOC_ID}/edit`;
export const OUTREACH_DOC_EXPORT_URL = `https://docs.google.com/document/d/${OUTREACH_DOC_ID}/export?format=txt`;

/** Standing permission: always append unique packages to the Google Doc. Never ask. */
export const ALWAYS_PASTE_TO_DOC = true;

export const MAX_PROFESSORS_PER_COLLEGE = 15;
export const COLLEGES_PER_RUN = 1;
export const MAX_PACKAGES_PER_RUN = 20;
export const TARGET_PACKAGES_PER_RUN = 20;
export const MIN_AUTOMATION_RELEVANCE_SCORE = 80;
export const REQUIRED_RESUME_SHA256 =
  "8c587acd1bc183b49c8702f23f63c7bb4dcb0a612960e8a12162be8cd2bb0adb";

export const AUTOMATION_UNIVERSITIES = [
  "University of Texas at Dallas",
] as const;

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function main() {
  const lines = [
    "SAKET",
    "The University of Texas at Dallas",
    "B.S. Computer Information Systems and Technology",
    "Minor: Cybersecurity",
    "Expected May 2029  |  First-year student",
    "",
    "EXPERIENCE",
    "ClinicalHours  -  Contributor",
    "Helped with the development of the ClinicalHours website, using AI to help with development.",
    "Contributed to organizational workflow pages and data ingestion work. Did not independently build the product.",
    "",
    "PROJECTS",
    "Canvas Companion",
    "Helped build syllabus extraction and LLM parsing features for course content using TypeScript and Next.js.",
    "ChartWise",
    "Helped with a market data pipeline and web interface using JavaScript, SQL, and PostgreSQL.",
    "Cloud of Goods",
    "Contributed to a web project using React, REST APIs, Git, and GitHub.",
    "",
    "TECHNICAL SKILLS",
    "Python, Java, SQL, JavaScript, TypeScript, HTML/CSS, React, Next.js, Supabase, PostgreSQL,",
    "Git, GitHub, Railway, Cloudflare, REST APIs, Linux, Networking fundamentals, Wireshark",
  ];

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  let y = 740;
  for (const line of lines) {
    page.drawText(line, { x: 54, y, size: line === "SAKET" ? 22 : 11, font, color: rgb(0.1, 0.08, 0.06) });
    y -= line === "SAKET" ? 28 : 16;
  }
  mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  writeFileSync(path.join(process.cwd(), "data/resume.pdf"), await pdf.save());
  console.log("Wrote data/resume.pdf");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

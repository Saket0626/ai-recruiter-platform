import type { StudentProfile } from "@/lib/validation/schemas";

export function ResumeProfile({ profile }: { profile: StudentProfile }) {
  return (
    <div className="mt-4 space-y-4 text-sm">
      <p>
        <strong>{profile.name}</strong>
        <br />
        {profile.university}
        <br />
        {profile.degree}
        {profile.minor ? `, Minor in ${profile.minor}` : ""}
        <br />
        {profile.currentStatus}. {profile.graduationDate}.
      </p>
      {profile.experiences.length ? (
        <div>
          <h3 className="font-semibold">Experience parsed from the PDF</h3>
          <ul className="mt-2 space-y-2">
            {profile.experiences.map((item) => (
              <li key={`${item.id}`}>
                <strong>{item.organization}</strong>
                {item.role ? ` · ${item.role}` : ""}
                <p className="mt-1 text-xs text-muted">Fact {item.id}</p>
                <p className="mt-1 text-muted">{item.excerpt || item.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {profile.projects.length ? (
        <div>
          <h3 className="font-semibold">Projects parsed from the PDF</h3>
          <ul className="mt-2 space-y-2">
            {profile.projects.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <p className="mt-1 text-xs text-muted">Fact {item.id}</p>
                <p className="mt-1 text-muted">{item.excerpt || item.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {profile.technicalSkills.length ? (
        <p>
          <strong>Skills:</strong> {profile.technicalSkills.join(", ")}
        </p>
      ) : null}
      <p className="text-muted">
        Emails can only use these parsed facts. The PDF is attached on send. This file stays off GitHub.
      </p>
    </div>
  );
}

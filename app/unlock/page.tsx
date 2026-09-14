import { Suspense } from "react";
import { UnlockForm } from "@/components/UnlockForm";

export default function UnlockPage() {
  return (
    <div className="py-16">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <UnlockForm />
      </Suspense>
    </div>
  );
}

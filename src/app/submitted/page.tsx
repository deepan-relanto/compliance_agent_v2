import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Submitted | Compliance Agent",
};

export default function SubmittedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h1 className="mt-6 text-xl font-semibold text-zinc-900">Training submitted</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-600">
        Thank you. Your assessment, attestation, and feedback are on record. You may close
        this tab.
      </p>
    </div>
  );
}

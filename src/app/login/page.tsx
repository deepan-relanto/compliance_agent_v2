import { LoginForm } from "@/components/auth/login-form";
import { LoginRedirect } from "@/components/auth/login-redirect";
import { RelantoLogo } from "@/components/brand/relanto-logo";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white">
      <LoginRedirect />
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden overflow-hidden border-r border-zinc-100 bg-zinc-50 lg:block">
          <div className="grid-pattern-light absolute inset-0" />
          <div className="relative flex h-full flex-col justify-between p-12">
            <RelantoLogo size="lg" showTagline />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#f15a24]">
                Compliance Agent V2
              </p>
              <h2 className="mt-4 max-w-md text-3xl font-semibold tracking-tight text-zinc-900 text-balance">
                Enforce engagement. Validate understanding.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
                Replace click-through training with gated pathways, validated
                MCQs, and real-time administrative control.
              </p>
            </div>
            <p className="text-xs text-zinc-400">© 2026 Relanto</p>
          </div>
        </div>
        <div className="flex items-center justify-center px-6 py-12 sm:px-14">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

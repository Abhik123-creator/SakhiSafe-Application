import Link from "next/link";

import { HeartHandshake, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { BrandingLogo, BrandingName } from "@/components/branding/branding-logo";

import { LoginForm } from "../../_components/login-form";
import { GoogleButton } from "../../_components/social-auth/google-button";

export default function LoginV1() {
  return (
    <main className="relative h-dvh overflow-hidden bg-white text-[#1d163d]">
      {/* Blob: peach / orange — bottom-left */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,195,130,0.75) 0%, rgba(255,160,80,0.35) 60%, transparent 100%)",
          filter: "blur(80px)",
          bottom: -160,
          left: -140,
          animation: "sakhi-blob-drift-a 14s ease-in-out infinite alternate",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Blob: purple — top-right */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(190,155,245,0.72) 0%, rgba(155,105,235,0.3) 60%, transparent 100%)",
          filter: "blur(80px)",
          top: -140,
          right: -120,
          animation: "sakhi-blob-drift-b 18s ease-in-out infinite alternate",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Blob: purple — bottom-right */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(205,175,255,0.65) 0%, rgba(165,120,245,0.25) 65%, transparent 100%)",
          filter: "blur(70px)",
          bottom: -80,
          right: -60,
          animation: "sakhi-blob-drift-c 20s ease-in-out infinite alternate",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div className="relative z-10 grid h-dvh overflow-hidden lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden h-dvh items-center justify-center overflow-hidden px-6 py-6 sm:px-10 lg:flex lg:px-14">
          <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
            <div className="w-full max-w-[26rem]">
              <BrandingLogo className="h-auto max-h-52 w-full object-contain sm:max-h-60" />
            </div>

            <div className="mt-5 max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#b29153]/35 bg-white/65 px-3 py-1.5 font-medium text-[#2b1853] text-xs shadow-sm">
                <ShieldCheck className="size-3.5 text-[#007f8e]" />
                Safe at home. Strong in life.
              </div>
              <h1 className="font-semibold text-3xl leading-tight sm:text-4xl">
                A secure workspace for care, response, and dignity.
              </h1>
              <p className="mx-auto max-w-xl text-[#4e4666] text-sm leading-6">
                Access protected case coordination, survivor support records, and trusted operational tools from one calm, private place.
              </p>
            </div>

            <div className="mt-5 grid w-full max-w-2xl gap-2 sm:grid-cols-3">
              {[
                { icon: HeartHandshake, label: "Support" },
                { icon: Sparkles, label: "Empower" },
                { icon: LockKeyhole, label: "Protect" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/70 bg-white/60 px-4 py-3 font-medium text-[#2b1853] text-sm shadow-sm backdrop-blur"
                >
                  <item.icon className="size-4 text-[#b29153]" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex h-dvh items-center justify-center overflow-hidden px-5 py-4 sm:px-8 lg:px-12">
          <div className="w-full max-w-[29rem]">
            <div className="mb-8 lg:hidden">
              <BrandingLogo className="mx-auto h-auto max-h-48 w-full max-w-xs object-contain" />
            </div>

            <div className="rounded-2xl border border-[#ead9c6] bg-white/90 p-6 shadow-[0_24px_70px_rgba(42,24,83,0.14)] backdrop-blur sm:p-8">
              <div className="mb-8 space-y-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-[#2b1853] text-white shadow-lg shadow-[#2b1853]/20">
                  <ShieldCheck className="size-6" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-[#b29153] text-sm uppercase tracking-[0.18em]">Authorized access</p>
                  <h2 className="font-semibold text-3xl text-[#1d163d]">Welcome back</h2>
                  <p className="text-[#635b73] text-sm leading-6">
                    Sign in to continue managing <BrandingName /> response operations.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <LoginForm />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-[#ead9c6] border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-[#8a7d93]">or continue with</span>
                  </div>
                </div>
                <GoogleButton className="h-11 w-full border-[#d8c4aa] bg-white text-[#2b1853] hover:bg-[#fff8f1]" variant="outline" />
                <p className="text-center text-[#756b83] text-xs">
                  Don&apos;t have an account?{" "}
                  <Link prefetch={false} href="register" className="font-medium text-[#007f8e] hover:text-[#2b1853]">
                    Register
                  </Link>
                </p>
              </div>
            </div>

            <p className="mt-6 text-center text-[#8a7d93] text-xs">
              Safety · Dignity · Respect · Justice
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

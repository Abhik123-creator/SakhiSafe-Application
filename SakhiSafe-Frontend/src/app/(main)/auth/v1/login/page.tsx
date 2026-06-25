import Link from "next/link";

import { HeartHandshake, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { BrandingLogo, BrandingName } from "@/components/branding/branding-logo";

import { LoginForm } from "../../_components/login-form";
import { GoogleButton } from "../../_components/social-auth/google-button";

const FEATURES = [
  { icon: HeartHandshake, label: "Support", sub: "You're never alone" },
  { icon: Sparkles, label: "Empower", sub: "Build your strength" },
  { icon: LockKeyhole, label: "Protect", sub: "Your data is secure" },
];

export default function LoginV1() {
  return (
    <main className="relative min-h-dvh bg-white text-[#1d163d]">
      {/* Blob: peach / orange — bottom-left */}
      <div
        aria-hidden
        style={{
          position: "fixed",
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
          position: "fixed",
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
          position: "fixed",
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

      <div className="relative z-10 lg:grid lg:h-dvh lg:grid-cols-[1.08fr_0.92fr] lg:overflow-hidden">

        {/* ── LEFT PANEL (desktop only) ── */}
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
                A secure workspace for care, response, and{" "}
                <span className="text-[#b29153]">dignity.</span>
              </h1>
              <p className="mx-auto max-w-xl text-[#4e4666] text-sm leading-6">
                Access protected case coordination, survivor support records, and trusted operational tools from one calm, private place.
              </p>
            </div>
            <div className="mt-5 grid w-full max-w-2xl gap-2 sm:grid-cols-3">
              {FEATURES.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-4 py-4 text-center shadow-sm backdrop-blur"
                >
                  <div className="flex size-9 items-center justify-center rounded-full bg-[#2b1853]/10">
                    <item.icon className="size-4 text-[#2b1853]" />
                  </div>
                  <p className="font-semibold text-[#2b1853] text-sm">{item.label}</p>
                  <p className="text-[#6b5f80] text-xs">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── RIGHT PANEL / FULL MOBILE ── */}
        <section className="flex min-h-dvh flex-col items-center justify-start overflow-y-auto px-5 py-8 sm:px-8 lg:h-dvh lg:justify-center lg:px-12">
          <div className="w-full max-w-[26rem]">

            {/* Mobile-only: logo + hero content */}
            <div className="mb-6 lg:hidden">
              {/* Logo card */}
              <div className="mb-5 flex items-center justify-center rounded-2xl border border-white/80 bg-white/80 p-5 shadow-lg backdrop-blur">
                <BrandingLogo className="h-auto max-h-44 w-full object-contain" />
              </div>

              {/* Badge */}
              <div className="mb-3 flex justify-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#b29153]/35 bg-white/70 px-3 py-1.5 font-medium text-[#2b1853] text-xs shadow-sm backdrop-blur">
                  <ShieldCheck className="size-3.5 text-[#007f8e]" />
                  Safe at home. Strong in life.
                </div>
              </div>

              {/* Heading */}
              <h1 className="mb-2 text-center font-bold text-2xl leading-tight text-[#1d163d]">
                A secure workspace for care, response, and{" "}
                <span className="text-[#b29153]">dignity.</span>
              </h1>
              <p className="mb-5 text-center text-[#5a4f72] text-sm leading-6">
                Access protected case coordination, survivor support records, and trusted operational tools from one calm, private place.
              </p>

              {/* Feature cards — 3 col grid on mobile */}
              <div className="mb-6 grid grid-cols-3 gap-2">
                {FEATURES.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-white/70 bg-white/70 px-2 py-4 text-center shadow-sm backdrop-blur"
                  >
                    <div className="flex size-9 items-center justify-center rounded-full bg-[#2b1853]/10">
                      <item.icon className="size-4 text-[#2b1853]" />
                    </div>
                    <p className="font-semibold text-[#1d163d] text-xs">{item.label}</p>
                    <p className="text-[10px] leading-tight text-[#6b5f80]">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Login form card */}
            <div className="rounded-2xl border border-[#ead9c6] bg-white/90 p-6 shadow-[0_24px_70px_rgba(42,24,83,0.14)] backdrop-blur sm:p-8">
              <div className="mb-6 space-y-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#2b1853] text-white shadow-lg shadow-[#2b1853]/20">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-[#b29153] text-xs uppercase tracking-[0.18em]">Authorized access</p>
                  <h2 className="font-bold text-2xl text-[#1d163d]">Welcome back</h2>
                  <p className="text-[#635b73] text-sm leading-6">
                    Sign in to continue managing <BrandingName /> response operations.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
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
                  <Link prefetch={false} href="register" className="font-semibold text-[#2b1853] hover:text-[#007f8e]">
                    Register
                  </Link>
                </p>
              </div>
            </div>

            <p className="mt-5 text-center text-[#8a7d93] text-xs">
              Safety · Dignity · Respect · Justice
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

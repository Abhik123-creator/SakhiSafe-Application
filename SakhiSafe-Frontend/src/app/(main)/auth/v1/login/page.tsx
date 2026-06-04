import Link from "next/link";
import Image from "next/image";

import { HeartHandshake, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { LoginForm } from "../../_components/login-form";
import { GoogleButton } from "../../_components/social-auth/google-button";
import logo from "../../../../../../media/LOGO.jpeg";

export default function LoginV1() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#fff8f1] text-[#1d163d]">
      <div className="grid min-h-dvh lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative flex min-h-[44rem] items-center justify-center overflow-hidden bg-[#fbf0e8] px-6 py-10 sm:px-10 lg:min-h-dvh lg:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(0,128,145,0.16),transparent_28%),radial-gradient(circle_at_80%_8%,rgba(178,145,83,0.22),transparent_24%),linear-gradient(135deg,rgba(42,24,83,0.1),transparent_48%)]" />
          <div className="absolute left-8 top-8 hidden h-24 w-24 rounded-full border border-[#2b1853]/15 lg:block" />
          <div className="absolute bottom-10 right-10 hidden h-32 w-32 rounded-full border border-[#b29153]/30 lg:block" />

          <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
            <div className="relative w-full max-w-[36rem]">
              <div className="absolute -inset-5 rounded-[2rem] bg-white/45 blur-2xl" />
              <Image
                src={logo}
                alt="SakhiSafe"
                priority
                className="relative h-auto w-full rounded-2xl border border-white/70 shadow-[0_30px_90px_rgba(42,24,83,0.2)]"
              />
            </div>

            <div className="mt-8 max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#b29153]/35 bg-white/65 px-4 py-2 font-medium text-[#2b1853] text-sm shadow-sm">
                <ShieldCheck className="size-4 text-[#007f8e]" />
                Safe at home. Strong in life.
              </div>
              <h1 className="font-semibold text-4xl leading-tight sm:text-5xl">
                A secure workspace for care, response, and dignity.
              </h1>
              <p className="mx-auto max-w-xl text-[#4e4666] text-base leading-7">
                Access protected case coordination, survivor support records, and trusted operational tools from one calm, private place.
              </p>
            </div>

            <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
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

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[29rem]">
            <div className="mb-8 lg:hidden">
              <Image src={logo} alt="SakhiSafe" priority className="mx-auto h-auto w-full max-w-xs rounded-2xl shadow-xl" />
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
                    Sign in to continue managing SakhiSafe response operations.
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

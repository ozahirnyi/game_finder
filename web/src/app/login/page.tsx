"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthPanel } from "@/features/auth/AuthPanel";

function LoginForm() {
  const searchParams = useSearchParams();
  const notice = searchParams.get("message") ?? "";
  return <AuthPanel mode="login" notice={notice} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

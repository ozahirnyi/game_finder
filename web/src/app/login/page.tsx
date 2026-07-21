"use client";

import { useRouterState } from "@tanstack/react-router";
import { Suspense } from "react";
import { AuthPanel } from "@/features/auth/AuthPanel";

function LoginForm() {
  const searchParams = new URLSearchParams(
    useRouterState({ select: (state) => state.location.searchStr }),
  );
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

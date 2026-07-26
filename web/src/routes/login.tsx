import { createFileRoute, useRouter } from "@tanstack/react-router";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { validateInternalReturnTo } from "@/features/auth/auth-navigation";

type LoginSearch = {
  returnTo: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    returnTo: validateInternalReturnTo(search.returnTo) ?? "/",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — GameFinder" },
      { name: "description", content: "Sign in to your PlayFinder account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { returnTo } = Route.useSearch();
  const router = useRouter();
  return (
    <LoginScreen
      navigate={(target) => router.history.push(target)}
      navigateExternal={(target) => window.location.assign(target)}
      returnTo={returnTo}
    />
  );
}

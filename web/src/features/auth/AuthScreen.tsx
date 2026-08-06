import type { QueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { ApiError, loginUser, registerUser } from "@/lib/api";
import { completeLogin } from "@/lib/auth-session";

type Props = {
  mode: "login" | "register";
  queryClient: QueryClient;
  onSuccess: () => void;
};

export function AuthScreen({ mode, queryClient, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (isRegister) await registerUser(email, password);
      const token = await loginUser(email, password);
      completeLogin(token.access_token, queryClient);
      onSuccess();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <main className="auth-page"><section className="auth-panel"><h1>{isRegister ? "Create account" : "Sign in"}</h1>{error ? <p role="alert">{error}</p> : null}<form onSubmit={submit}><label>Email<input aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit" disabled={pending}>{pending ? "Please wait" : isRegister ? "Create account" : "Sign in"}</button></form><a href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</a></section></main>;
}

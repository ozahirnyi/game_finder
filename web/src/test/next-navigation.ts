export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useRouter() {
  return { push: () => undefined, replace: () => undefined };
}

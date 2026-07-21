export function useRouter() {
  return { push: () => undefined, replace: () => undefined };
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function usePathname() {
  return "/";
}

export function useParams() {
  return {};
}

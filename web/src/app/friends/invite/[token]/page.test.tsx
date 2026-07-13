import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvitePageContent } from "./page";

describe("friend invite route", () => {
  it("renders an actionable invalid-invite state", () => {
    const html = renderToStaticMarkup(<InvitePageContent state="invalid" />);

    expect(html).toContain("This invite is invalid or has been rotated.");
    expect(html).toContain('href="/friends"');
  });

  it("renders a signed-in confirmation before accepting an invite", () => {
    const html = renderToStaticMarkup(<InvitePageContent state="ready" ownerNickname="Player One" onAccept={() => undefined} />);

    expect(html).toContain("Join Player One&#x27;s gaming circle?");
    expect(html).toContain("Accept invite");
  });

  it("keeps the invite path when asking a signed-out visitor to log in", () => {
    const html = renderToStaticMarkup(<InvitePageContent state="login" loginHref="/login?next=%2Ffriends%2Finvite%2Ftoken" />);

    expect(html).toContain("Log in to view and accept this friend invite.");
    expect(html).toContain("next=%2Ffriends%2Finvite%2Ftoken");
  });
});

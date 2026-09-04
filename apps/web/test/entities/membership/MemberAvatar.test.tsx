import { fireEvent, render, screen } from "@testing-library/react";
import { MemberAvatar } from "@/entities/membership/index.js";

const member = (image: string | null) => ({ id: "m1", name: "Buyer", image });

describe("MemberAvatar", () => {
  it("draws the initial when the member has no picture", () => {
    render(<MemberAvatar member={member(null)} />);
    expect(screen.queryByRole("img", { name: "Buyer" })).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("never renders the marker as an address", () => {
    render(<MemberAvatar member={member("2026-08-31T12:00:00.000Z")} />);
    expect(screen.getByRole("img", { name: "Buyer" }))
      .toHaveAttribute("src", "/api/members/m1/avatar");
  });

  it("falls back to the initial when the picture cannot be loaded", () => {
    render(<MemberAvatar member={member("2026-08-31T12:00:00.000Z")} />);
    fireEvent.error(screen.getByRole("img", { name: "Buyer" }));
    expect(screen.queryByRole("img", { name: "Buyer" })).not.toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});

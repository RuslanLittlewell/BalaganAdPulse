## Decisions

- **A filler column takes the spare width.** The last column, which holds the column menu, has no
  width of its own in the fixed table layout, so it alone grows when the columns are narrower than
  the table and the chosen widths are drawn exactly.
- **Resizing at capacity pushes right.** A resize computes the widths of every shown figure column
  from what is on screen: the resized column takes its new width and the excess over the room is
  taken from the columns to its right, nearest first, down to the minimum. The widths written are
  the ones drawn, so nothing jumps when the pointer is released. Only when the columns to the right
  are all at their minimum does the proportional fit narrow the rest.
- **Keys per account.** The campaign table is keyed `campaigns:<channel>:<account>` by the chosen
  account tab and the ad set table `ad-sets:<channel>:<account>` by the campaign's account; without
  an account they keep `campaigns` and `ad-sets`. A key seen for the first time copies the layout of
  the plain key once, so a member's earlier choices carry over to every account.

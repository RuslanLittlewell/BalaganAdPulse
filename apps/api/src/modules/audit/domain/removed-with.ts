export type DependentCounts = Readonly<Record<string, number>>;

export function removedWith(counts: DependentCounts): { readonly removedWith?: DependentCounts } {
  const present = Object.entries(counts).filter(([, count]) => count > 0);
  return present.length === 0 ? {} : { removedWith: Object.fromEntries(present) };
}

export function removedWithChanges(counts: DependentCounts): { readonly changes?: { readonly removedWith: DependentCounts } } {
  const { removedWith: present } = removedWith(counts);
  return present ? { changes: { removedWith: present } } : {};
}

export function Disclaimer() {
  return (
    <aside
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      role="note"
    >
      <p className="font-medium">Important</p>
      <p className="mt-1 text-pretty">
        An arrest or booking is not a conviction. Information comes from public agency sites,
        may be incomplete or wrong, and can change without notice. Always verify with the
        official source. This site does not provide legal advice.
      </p>
    </aside>
  );
}

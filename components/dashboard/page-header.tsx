export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      {description ? (
        <p className="mt-1 text-base text-neutral-600">{description}</p>
      ) : null}
    </header>
  );
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Every avatar in the app renders the same way: an uploaded photo if the
// person has one, otherwise a circle of their initials in their chosen
// color. Centralized here so sidebar.tsx, the employees list, and the
// profile card in Settings can't drift out of sync with each other.
export function Avatar({
  name,
  avatarColor,
  avatarImage,
  size = 36,
  className = "",
}: {
  name: string;
  avatarColor: string | null;
  avatarImage?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatarImage) {
    return (
      // avatarImage is an in-memory data URL, not a remote asset next/image
      // would optimize.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarImage}
        alt={name}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, backgroundColor: avatarColor ?? "#27272a", fontSize: Math.max(10, size * 0.32) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
    >
      {initialsFor(name)}
    </span>
  );
}

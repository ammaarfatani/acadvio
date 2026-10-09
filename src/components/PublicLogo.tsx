export default function PublicLogo({ className = "w-36" }: { className?: string; dark?: boolean }) {
  const customLogo = process.env.NEXT_PUBLIC_ACADEMY_LOGO_URL;
  return (
    <span className={`relative block aspect-[4/1] shrink-0 overflow-hidden ${className}`}>
      <img
        src={customLogo || "/logo.png"}
        alt="Acadivo"
        draggable={false}
        className={customLogo
          ? "h-full w-full object-contain"
          : "absolute left-[-13%] top-[-70%] w-[126%] max-w-none"}
      />
    </span>
  );
}

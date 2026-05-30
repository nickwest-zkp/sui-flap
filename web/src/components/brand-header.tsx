import Image from "next/image";
import Link from "next/link";

export function BrandHeader({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href?: string;
}) {
  const content = (
    <>
      <Image
        alt="SuiFlap logo"
        className="h-12 w-12 shrink-0 rounded-full border border-stone-300 bg-stone-950 object-cover"
        height={48}
        src="/suiflap-logo.svg"
        width={48}
      />
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-orange-700">{subtitle}</p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-stone-950">{title}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link className="flex items-center gap-3" href={href}>
        {content}
      </Link>
    );
  }

  return <div className="flex items-center gap-3">{content}</div>;
}

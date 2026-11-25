import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-secondary text-foreground",
  ok: "bg-[#e5f4ec] text-[#135c3d]",
  wait: "bg-[#f8efd8] text-[#7a5410]",
  warn: "bg-[#f8e4dc] text-[#8a3320]",
  ink: "bg-sidebar text-sidebar-foreground",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

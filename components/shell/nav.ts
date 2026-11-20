import type { ComponentType, SVGProps } from "react";
import {
  ApprovalIcon,
  AuditIcon,
  CommandIcon,
  DnaIcon,
  HistoryIcon,
  ImageIcon,
  InsightsIcon,
  SocialIcon,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Command Centre",
    description: "Workspace overview and recent activity",
    icon: CommandIcon,
  },
  {
    href: "/brand-dna",
    label: "Brand DNA",
    description: "Identity, voice, terminology and claims",
    icon: DnaIcon,
  },
  {
    href: "/audit",
    label: "AI Audit Studio",
    description: "Review content against the brand rules",
    icon: AuditIcon,
  },
  {
    href: "/social",
    label: "Social Readiness",
    description: "Caption and creative, checked before it goes out",
    icon: SocialIcon,
  },
  {
    href: "/visual",
    label: "Visual Compliance",
    description: "Compare artwork against the approved mark",
    icon: ImageIcon,
  },
  {
    href: "/approvals",
    label: "Approval Workspace",
    description: "Human sign-off on flagged content",
    icon: ApprovalIcon,
  },
  {
    href: "/history",
    label: "Audit History",
    description: "Every audit run, and how versions compare",
    icon: HistoryIcon,
  },
  {
    href: "/insights",
    label: "Insights",
    description: "Trends across audits and channels",
    icon: InsightsIcon,
  },
];

/** Longest-prefix match, so nested routes keep their parent highlighted. */
export function matchNav(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
    );
}

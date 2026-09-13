import type { SVGProps } from "react";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icon = {
  home: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>
  ),
  store: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M4 4h16l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" /><path d="M5 12v8h14v-8" /></svg>
  ),
  grid: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>
  ),
  burger: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M4 9a8 4 0 0 1 16 0z" /><path d="M4 13h16" /><path d="M5 16h14a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3z" /></svg>
  ),
  table: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M3 9h18" /><path d="M6 9v11" /><path d="M18 9v11" /><path d="M4 9 6 5h12l2 4" /></svg>
  ),
  qr: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" /></svg>
  ),
  receipt: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>
  ),
  palette: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3 3h-1.5a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 21z" /><circle cx="7.5" cy="11" r="1" /><circle cx="12" cy="7.5" r="1" /><circle cx="16.5" cy="11" r="1" /></svg>
  ),
  settings: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.7V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
  ),
  shield: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
  ),
  users: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 20a6 6 0 0 0-2-4.5" /></svg>
  ),
  bell: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M18 15V10a6 6 0 1 0-12 0v5l-2 3h16z" /><path d="M10 21h4" /></svg>
  ),
  plus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
  ),
  sparkles: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></svg>
  ),
  download: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 19h16" /></svg>
  ),
  print: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>
  ),
  trash: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M4 6h16" /><path d="M9 6V4h6v2" /><path d="M6 6l1 14h10l1-14" /></svg>
  ),
  edit: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M4 20h4l10-10-4-4L4 16z" /><path d="m14 6 4 4" /></svg>
  ),
  external: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
  ),
  image: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9.5" r="1.6" /><path d="m4 17 5-5 4 4 3-2 4 4" /></svg>
  ),
  whatsapp: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.6.7.7-2.5-.2-.3A8 8 0 0 1 12 4zm-3 4c-.3 0-.6.1-.8.4-.3.3-.9.9-.9 2s.9 2.3 1 2.5c.1.2 1.7 2.8 4.2 3.8 2 .8 2.4.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.7-.4-1.5-.7c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.5-.6c.1-.2.2-.3.3-.5v-.5l-.7-1.6c-.2-.4-.4-.4-.6-.4z" /></svg>
  ),
  check: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="m5 13 4 4L19 7" /></svg>
  ),
  clock: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  search: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  ),
  menu: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
  ),
  chevronRight: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="m9 5 7 7-7 7" /></svg>
  ),
  arrowUp: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
  ),
  arrowDown: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 5v14M5 12l7 7 7-7" /></svg>
  ),
  logout: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M16 16l4-4-4-4" /><path d="M20 12H10" /></svg>
  ),
  userPlus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="8.5" cy="7" r="3.5" /><path d="M18 8v6M21 11h-6" /></svg>
  ),
  chef: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M7 14a4 4 0 0 1-1-7.9A3.5 3.5 0 0 1 12 4a3.5 3.5 0 0 1 6 2.1A4 4 0 0 1 17 14z" /><path d="M7 14v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-5" /><path d="M7 17h10" /></svg>
  ),
  waiter: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M3 18h18" /><path d="M5 18a7 7 0 0 1 14 0" /><path d="M12 8V5" /><circle cx="12" cy="4" r="1" /></svg>
  ),
  phone: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg>
  ),
  volume: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M4 9.5h3L11 6v12l-4-3.5H4z" /><path d="M15 9.5a4 4 0 0 1 0 5" /><path d="M17.8 7a8 8 0 0 1 0 10" /></svg>
  ),
  flame: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M12 3s5 4 5 8a5 5 0 0 1-10 0c0-1.6.8-3 1.6-4 .3 1.2 1 1.8 1.7 1.8C12 8.8 12 6 12 3z" /><path d="M7 11a5 5 0 0 0 10 0" opacity="0" /></svg>
  ),
  wifi: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base} {...p}><path d="M2.5 9a15 15 0 0 1 19 0" /><path d="M6 12.5a10 10 0 0 1 12 0" /><path d="M9.5 16a5 5 0 0 1 5 0" /><circle cx="12" cy="19.5" r="1" /></svg>
  ),
};

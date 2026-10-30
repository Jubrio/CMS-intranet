import {
  Blocks,
  CalendarCheck,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutTemplate,
  Megaphone,
  Newspaper,
  Palette,
  ScrollText,
  ShieldCheck,
  Users,
  Contact,
  type LucideIcon,
} from "lucide-react";

const ICONES: Record<string, LucideIcon> = {
  utilisateurs: Users,
  roles: ShieldCheck,
  personnalisation: Palette,
  actualites: Newspaper,
  annonces: Megaphone,
  articles: FileText,
  notes_service: ScrollText,
  annuaire: Contact,
  documents: FolderOpen,
  calendrier: CalendarDays,
  evenements: CalendarCheck,
  faq: CircleHelp,
  formulaires: ClipboardList,
  pages: LayoutTemplate,
};

export function iconeModule(code: string): LucideIcon {
  return ICONES[code] ?? Blocks;
}

import { Bell, CheckCircle2, FolderOpen, Layers, LayoutDashboard, Newspaper, Settings, Users } from "lucide-react";

export function DashboardPreview({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        aria-hidden="true"
        className="v-glass rounded-2xl border border-site-line p-4 shadow-2xl shadow-brand-violet/10"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-sm font-semibold">
            <span className="v-gradient-btn flex size-5 items-center justify-center rounded">
              <Layers size={12} />
            </span>
            Intranet
          </div>
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400/70" />
            <span className="size-2.5 rounded-full bg-yellow-400/70" />
            <span className="size-2.5 rounded-full bg-green-400/70" />
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-site-line bg-site-surface p-4">
            <p className="mb-1 text-xs text-site-muted">Actualités</p>
            <p className="font-display text-xl font-bold">Publiées</p>
          </div>
          <div className="rounded-xl border border-site-line bg-site-surface p-4">
            <p className="mb-1 text-xs text-site-muted">Notes de service</p>
            <p className="font-display text-xl font-bold">À lire</p>
          </div>
        </div>
        <div className="rounded-xl border border-site-line bg-site-surface p-4">
          <p className="mb-3 text-xs text-site-muted">Confirmations de lecture</p>
          <div className="h-2 overflow-hidden rounded-full bg-site-line">
            <div className="v-gradient-btn h-full w-[72%] rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const menu = [
    { label: "Accueil", icon: LayoutDashboard, actif: true },
    { label: "Actualités", icon: Newspaper },
    { label: "Documents", icon: FolderOpen },
    { label: "Annuaire", icon: Users },
    { label: "Paramètres", icon: Settings },
  ];

  return (
    <div
      aria-hidden="true"
      className="v-glass overflow-hidden rounded-2xl border border-site-line text-left shadow-2xl shadow-brand-violet/10"
    >
      <div className="flex">
        <aside className="hidden w-52 flex-col gap-1 border-r border-site-line bg-site-surface px-4 py-6 text-sm md:flex">
          <div className="mb-6 flex items-center gap-2 px-2 font-display font-semibold">
            <span className="v-gradient-btn flex size-5 items-center justify-center rounded">
              <Layers size={12} />
            </span>
            Intranet
          </div>
          {menu.map(({ label, icon: Icone, actif }) => (
            <span
              key={label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
                actif ? "bg-brand-violet/15 font-medium text-site-ink" : "text-site-muted"
              }`}
            >
              <Icone size={16} />
              {label}
            </span>
          ))}
        </aside>

        <div className="flex-1 p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Bonjour, Administrateur</p>
            <span className="flex size-8 items-center justify-center rounded-full border border-site-line bg-site-surface2 text-site-muted">
              <Bell size={16} />
            </span>
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-site-line bg-site-surface p-5">
              <p className="mb-3 flex items-center gap-2 text-xs text-site-muted">
                <Newspaper size={14} /> Dernières actualités
              </p>
              <div className="space-y-2.5">
                <div className="h-2.5 w-11/12 rounded-full bg-site-line" />
                <div className="h-2.5 w-4/5 rounded-full bg-site-line" />
                <div className="h-2.5 w-2/3 rounded-full bg-site-line" />
              </div>
            </div>
            <div className="rounded-xl border border-site-line bg-site-surface p-5">
              <p className="mb-3 flex items-center gap-2 text-xs text-site-muted">
                <CheckCircle2 size={14} /> Notes de service
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-site-line">
                <div className="v-gradient-btn h-full w-[72%] rounded-full" />
              </div>
              <p className="mt-3 text-xs text-site-muted">Confirmations de lecture en cours</p>
            </div>
          </div>

          <div className="rounded-xl border border-site-line bg-site-surface p-5">
            <p className="mb-4 text-xs text-site-muted">Activité récente</p>
            <svg viewBox="0 0 500 110" className="h-24 w-full">
              <polyline
                points="0,90 50,70 100,80 150,40 200,60 250,25 300,50 350,15 400,45 450,10 500,30"
                fill="none"
                stroke="url(#courbe)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="courbe" x1="0" x2="1">
                  <stop offset="0" style={{ stopColor: "var(--grad-text-a)" }} />
                  <stop offset="1" style={{ stopColor: "var(--brand-cyan)" }} />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

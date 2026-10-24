import { CheckCheck } from "lucide-react";
import { ButtonLink } from "../button-link";
import { DashboardPreview } from "../dashboard-preview";
import { Entree } from "../reveal";
import { Compteur } from "../stat";

export function Hero({ nombreModules }: { nombreModules: number }) {
  return (
    <section id="top" className="v-noise relative overflow-hidden px-6 pb-24 pt-40 lg:px-10 lg:pb-32 lg:pt-48">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[55%_45%]">
        {/* Colonne texte : entre de la gauche vers la droite */}
        <div>
          <Entree depuis="gauche" delay={0.05}>
            <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Créez l&apos;intranet de votre entreprise.
              <br />
              <span className="v-gradient-text relative inline-block pb-3">
                En quelques minutes.
                <svg
                  viewBox="0 0 300 14"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute -bottom-0 left-0 h-3.5 w-full"
                >
                  <path
                    d="M2 10 C 80 2, 220 2, 298 10"
                    stroke="url(#soulignement)"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="soulignement" x1="0" x2="1">
                      <stop offset="0" style={{ stopColor: "var(--grad-text-a)" }} />
                      <stop offset="1" style={{ stopColor: "var(--grad-text-b)" }} />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
          </Entree>

          <Entree depuis="gauche" delay={0.2} className="mt-7 max-w-lg">
            <p className="text-lg leading-relaxed text-site-muted">
              CMS Intranet rassemble actualités, documents, annuaire et formulaires dans un espace unique. Vous activez
              uniquement les modules dont votre entreprise a besoin.
            </p>
          </Entree>

          <Entree depuis="gauche" delay={0.35} className="mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href="/creer-intranet">Créer mon intranet</ButtonLink>
            <ButtonLink href="/#modules" variante="secondary">
              Découvrir les modules
            </ButtonLink>
          </Entree>

          <Entree depuis="gauche" delay={0.5} className="mt-14">
            <dl className="flex flex-wrap items-start gap-x-10 gap-y-6 text-sm text-site-muted">
              <div>
                <dt className="sr-only">Modules disponibles</dt>
                <dd>
                  <Compteur cible={nombreModules} /> modules disponibles
                </dd>
              </div>
              <div>
                <dt className="sr-only">Mise en route</dt>
                <dd>
                  <span className="font-display text-2xl font-bold text-site-ink">3</span> étapes pour démarrer
                </dd>
              </div>
              <div>
                <dt className="sr-only">Séparation des données</dt>
                <dd>
                  Données <span className="font-semibold text-site-ink">isolées</span> par entreprise
                </dd>
              </div>
            </dl>
          </Entree>
        </div>

        {/* Aperçu : entre de la droite vers la gauche */}
        <Entree depuis="droite" delay={0.3} className="relative">
          <DashboardPreview compact />
          <div className="v-glass absolute -bottom-6 -left-6 hidden items-center gap-3 rounded-xl border border-site-line px-4 py-3 shadow-xl sm:flex">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-cyan/20 text-brand-cyan">
              <CheckCheck size={18} strokeWidth={2} />
            </span>
            <div>
              <p className="text-xs font-semibold">Note de service lue</p>
              <p className="text-[11px] text-site-muted">Confirmation enregistrée</p>
            </div>
          </div>
        </Entree>
      </div>
    </section>
  );
}

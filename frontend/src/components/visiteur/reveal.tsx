"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion, useScroll, useSpring } from "framer-motion";

const DECALAGE_X = -56;
const COURBE = [0.22, 1, 0.36, 1] as const;
const VISIBLE = { once: true, amount: 0.2 } as const;

export function Mouvement({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type RevealProps = { children: ReactNode; className?: string; delay?: number };

export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: DECALAGE_X }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={VISIBLE}
      transition={{ duration: 0.7, ease: COURBE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className = "", delay = 0 }: RevealProps) {
  return (
    <motion.li
      className={className}
      initial={{ opacity: 0, x: DECALAGE_X }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={VISIBLE}
      transition={{ duration: 0.6, ease: COURBE, delay }}
    >
      {children}
    </motion.li>
  );
}

const DECALAGE_ENTREE = 72;

type EntreeProps = RevealProps & { depuis?: "gauche" | "droite" };

export function Entree({ children, className = "", delay = 0, depuis = "gauche" }: EntreeProps) {
  const x = depuis === "gauche" ? -DECALAGE_ENTREE : DECALAGE_ENTREE;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: COURBE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function BarreProgression() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });

  return (
    <motion.div
      aria-hidden
      className="v-gradient-btn fixed inset-x-0 top-0 z-[60] h-[3px] origin-left"
      style={{ scaleX }}
    />
  );
}

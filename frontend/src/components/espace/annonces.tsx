"use client";

import { Contenus } from "./contenus";
import { ANNONCES } from "./contenus-config";

export function Annonces() {
  return <Contenus config={ANNONCES} />;
}

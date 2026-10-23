"use client";

import { Contenus } from "./contenus";
import { ACTUALITES } from "./contenus-config";

export function Actualites() {
  return <Contenus config={ACTUALITES} />;
}

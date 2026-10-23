"use client";

import { Contenus } from "./contenus";
import { ARTICLES } from "./contenus-config";

export function Articles() {
  return <Contenus config={ARTICLES} />;
}

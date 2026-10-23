"use client";

import { Contenus } from "./contenus";
import { NOTES_SERVICE } from "./contenus-config";

export function NotesService() {
  return <Contenus config={NOTES_SERVICE} />;
}

import { Suspense } from "react";
import { FilActualite } from "@/components/espace/fil-actualite";

export default function PageAccueil() {
  return (
    <Suspense fallback={null}>
      <FilActualite />
    </Suspense>
  );
}

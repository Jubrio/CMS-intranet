import { Suspense } from "react";
import { CalendrierConsultation } from "@/components/espace/calendrier-consultation";

export default function PageCalendrier() {
  return (
    <Suspense fallback={null}>
      <CalendrierConsultation />
    </Suspense>
  );
}

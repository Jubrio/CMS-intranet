import { api } from "@/lib/api";

export default async function Home() {
  const sante = await api<{ status: string }>("/health", { cache: "no-store" });
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">CMS Intranet</h1>
      <p>État de l&apos;API : {sante.status}</p>
    </main>
  );
}
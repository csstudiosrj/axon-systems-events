import { redirect } from "next/navigation";

export default function RootPage() {
  // Redireciona a raiz do domínio diretamente para a porta da frente
  redirect("/acesso");
}
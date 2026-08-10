import { redirect } from "next/navigation";

export default function NewMissionPage() {
  redirect("/professor/criar?modo=missao#missao");
}

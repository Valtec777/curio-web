import { redirect } from "next/navigation";

const CURRENT_PRESENTATION_URL =
  "https://plumareli-web-crcv-git-release-plumareli-current-ready-curio16.vercel.app/apresentacao";

export default function PresentationRedirectPage() {
  redirect(CURRENT_PRESENTATION_URL);
}

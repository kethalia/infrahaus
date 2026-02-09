import { redirect } from "next/navigation";

/**
 * /containers redirects to the dashboard (/) where the container grid lives.
 * This ensures direct navigation to /containers shows the dashboard view.
 */
export default function ContainersPage() {
  redirect("/");
}

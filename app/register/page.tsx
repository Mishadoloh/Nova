import { getChatGPTUser } from "../chatgpt-auth";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getChatGPTUser();
  return <RegistrationForm identity={user ? { displayName: user.displayName, email: user.email } : null} />;
}

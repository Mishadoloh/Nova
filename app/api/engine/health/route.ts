import { apiOk } from "../../backend";
import { engineHealth } from "../../../lib/polyglot";

export async function GET() {
  return apiOk(await engineHealth());
}

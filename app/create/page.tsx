import { AccessLayout } from "../../components/access-layout";
import { CreateProfileForm } from "../../components/access-forms";
import { verificationAvailable } from "../../lib/verification-email";

export const dynamic = "force-dynamic";

export default function CreateProfilePage() {
  return <AccessLayout><CreateProfileForm emailAvailable={verificationAvailable()} /></AccessLayout>;
}

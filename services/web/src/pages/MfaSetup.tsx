import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { confirmSignIn } from "aws-amplify/auth";

// props we pass via navigate state
interface LocationState {
  totpSetupDetails?: {
    sharedSecret: string;
    getSetupUri: () => string;
  };
}

export function MfaSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Amplify gives us a helper to generate QR
  const setupUri = state?.totpSetupDetails?.getSetupUri();
  if (!setupUri) {
    return <div>No TOTP setup details found. Please sign in again.</div>;
  }

  async function handleVerify() {
    try {
      const result = await confirmSignIn({
        challengeResponse: code, // the 6-digit TOTP code
      });

      if (result.isSignedIn) {
        navigate("/home");
      } else {
        console.warn("Unexpected next step:", result.nextStep);
      }
    } catch (err: any) {
      console.error("Error verifying code:", err);
      setError("Invalid code, try again.");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-xl font-bold">Set up MFA</h1>
      <p>Scan the QR code below with your Authenticator app:</p>
      <img
        alt="MFA QR"
        src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
          setupUri
        )}&size=200x200`}
      />
      <input
        className="border p-2 rounded"
        type="text"
        placeholder="Enter 6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button
        onClick={handleVerify}
        className="bg-blue-500 text-white p-2 rounded"
      >
        Verify Code
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}

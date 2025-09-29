import { useState } from "react";
import { confirmSignIn } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";

export function MfaVerify() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  async function handleVerify() {
    const result = await confirmSignIn({ challengeResponse: code });
    if (result.isSignedIn) navigate("/home");
  }

  return (
    <div>
      <h1>Enter your MFA Code</h1>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="MFA Code"
      />
      <button onClick={handleVerify}>Verify</button>
    </div>
  );
}

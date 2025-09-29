import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "aws-amplify/auth";

export function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn({
        username: email,
        password,
        options: { authFlowType: "CUSTOM_WITH_SRP" }, // important for our setup
      });

      if (result.isSignedIn) {
        navigate("/home");
      } else {
        switch (result.nextStep.signInStep) {
          case "CONTINUE_SIGN_IN_WITH_TOTP_SETUP":
            navigate("/mfa-setup", {
              state: { totpSetupDetails: result.nextStep.totpSetupDetails },
            });
            break;
          case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
          case "CONFIRM_SIGN_IN_WITH_SMS_CODE":
            navigate("/mfa-verify");
            break;
          default:
            console.warn("Unhandled next step:", result.nextStep);
        }
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      setError(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 p-6 border rounded-md w-80"
      >
        <h1 className="text-xl font-bold">Sign In</h1>
        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </form>
    </div>
  );
}

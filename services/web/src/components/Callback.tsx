import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export const Callback: React.FC = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState<string>("");

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // This will handle the OAuth callback and exchange the code for tokens
      await fetchAuthSession();
      setStatus("success");

      // Redirect to home page after successful authentication
    } catch (error) {
      console.error("Authentication error:", error);
      setError(
        error instanceof Error ? error.message : "Authentication failed"
      );
      setStatus("error");
    }
  };

  if (status === "loading") {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Completing sign in...</h2>
        <p>Please wait while we complete your authentication.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Authentication Error</h2>
        <p style={{ color: "red" }}>{error}</p>
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginTop: "10px",
          }}
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>Sign in successful!</h2>
      <p>Redirecting you to the home page...</p>
    </div>
  );
};

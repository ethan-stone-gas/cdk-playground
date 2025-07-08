import React, { useState, useEffect } from "react";
import { signInWithRedirect, signOut, getCurrentUser } from "aws-amplify/auth";

interface User {
  username: string;
}

export const Auth: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      console.log("currentUser", currentUser);
      setUser({
        username: currentUser.username,
      });
    } catch (error) {
      console.error(error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithRedirect();
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>AWS Cognito + EntraID Authentication</h1>

      {user ? (
        <div>
          <h2>Welcome, {user.username}!</h2>
          <button
            onClick={handleSignOut}
            style={{
              padding: "10px 20px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div>
          <h2>Please sign in</h2>
          <p>
            This app uses AWS Cognito with Microsoft EntraID integration for
            authentication.
          </p>
          <button
            onClick={handleSignIn}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Sign In with EntraID
          </button>
        </div>
      )}
    </div>
  );
};

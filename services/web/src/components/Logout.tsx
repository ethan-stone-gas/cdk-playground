import React, { useEffect } from "react";
import { signOut } from "aws-amplify/auth";

export const Logout: React.FC = () => {
  useEffect(() => {
    handleLogout();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      // Redirect to home page after logout
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error) {
      console.error("Logout error:", error);
      // Redirect anyway
      window.location.href = "/";
    }
  };

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h2>Signing out...</h2>
      <p>Please wait while we sign you out.</p>
    </div>
  );
};

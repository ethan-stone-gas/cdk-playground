import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/auth";

type Props = {
  children: React.ReactNode;
};

export function ProtectedPage({ children }: Props) {
  const { data: user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  return children;
}

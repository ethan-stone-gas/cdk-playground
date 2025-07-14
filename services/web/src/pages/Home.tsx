import { signOut } from "aws-amplify/auth";

export function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Home</h1>
      <button
        className="cursor-pointer bg-blue-500 text-white rounded-md p-2"
        onClick={() => signOut()}
      >
        Sign Out
      </button>
    </div>
  );
}

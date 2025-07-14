import { signIn } from "aws-amplify/auth";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

type SignInForm = {
  email: string;
  password: string;
};

export function SignIn() {
  const navigate = useNavigate();
  const { register, handleSubmit } = useForm<SignInForm>();

  const onSubmit = async (data: SignInForm) => {
    const result = await signIn({
      username: data.email,
      password: data.password,
    });

    if (result.isSignedIn) {
      navigate("/home");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Sign In</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <input
          className="border border-gray-300 rounded-md p-2"
          type="text"
          placeholder="Email"
          {...register("email")}
        />
        <input
          className="border border-gray-300 rounded-md p-2"
          type="password"
          placeholder="Password"
          {...register("password")}
        />
        <button
          className="bg-blue-500 text-white rounded-md p-2 cursor-pointer"
          type="submit"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}

import { useForm } from "react-hook-form";
import {
  useCreateDomainVerification,
  useGetDomainConfiguration,
} from "../hooks/domain-verification";
import { useQueryClient } from "@tanstack/react-query";

type ConfigureDomainForm = {
  domain: string;
};

export function ConfigureDomain() {
  const { register, handleSubmit } = useForm<ConfigureDomainForm>();

  const queryClient = useQueryClient();

  const { mutateAsync: createDomainVerification } =
    useCreateDomainVerification();

  const { data: domainConfiguration, isLoading: isLoadingDomainConfiguration } =
    useGetDomainConfiguration();

  const onSubmit = async (data: ConfigureDomainForm) => {
    await createDomainVerification(data.domain);

    await queryClient.invalidateQueries({ queryKey: ["domain-configuration"] });
  };

  if (isLoadingDomainConfiguration) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (domainConfiguration) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">Domain Configuration</h1>
        <div>
          <p>Domain verified: {domainConfiguration.verified ? "Yes" : "No"}</p>
          <p>Record Name: {domainConfiguration.recordName}</p>
          <p>Record Value: {domainConfiguration.recordValue}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Configure Domain</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <input
          className="border border-gray-300 rounded-md p-2"
          type="text"
          placeholder="Domain"
          {...register("domain")}
        />
        <button
          className="cursor-pointer bg-blue-500 text-white rounded-md p-2"
          type="submit"
        >
          Configure
        </button>
      </form>
    </div>
  );
}

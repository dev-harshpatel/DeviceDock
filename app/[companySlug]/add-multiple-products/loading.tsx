import { Loader } from "@/components/common/Loader";

export default function AddMultipleProductsLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full items-center justify-center">
      <Loader size="lg" text="Loading form..." />
    </div>
  );
}

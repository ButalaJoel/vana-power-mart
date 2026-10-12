export function AnnouncementBar() {
  return (
    <div className="bg-[var(--vana-green-dark)] text-white">
      <div className="mx-auto flex min-h-9 w-full max-w-[1440px] items-center justify-between gap-3 px-4 text-[11px] font-medium sm:px-6 sm:text-xs lg:px-10">
        <p>Free delivery in Kampala on orders above UGX 500,000</p>
        <p className="shrink-0">Need help? +256 700 123 456</p>
      </div>
    </div>
  )
}
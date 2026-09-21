export default function Custom500() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 p-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-extrabold text-white">500 - Server Error</h1>
        <p className="text-sm text-slate-400">
          An unexpected server error occurred. Please refresh or check back shortly.
        </p>
      </div>
    </div>
  );
}

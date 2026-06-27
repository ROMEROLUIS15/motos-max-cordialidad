import Image from 'next/image';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Image
            src="/brand/logo-motos-max.jpeg"
            alt="Cargando..."
            width={80}
            height={80}
            className="h-16 w-16 rounded-xl object-contain sm:h-20 sm:w-20"
            priority
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

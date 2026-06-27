import Image from 'next/image';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <Image
            src="/brand/logo-motos-max.jpeg"
            alt="Cargando..."
            width={120}
            height={120}
            className="h-24 w-24 rounded-2xl object-contain sm:h-28 sm:w-28"
            priority
          />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-lg font-semibold text-foreground">Motos Max Cordialidad</p>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    </div>
  );
}

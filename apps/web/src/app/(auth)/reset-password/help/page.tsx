import Link from 'next/link';
import { ArrowLeft, Lock, Clock, ShieldCheck, KeyRound } from 'lucide-react';

export const metadata = {
  title: 'Ayuda — Recuperación de contraseña | Motos Max Cordialidad',
  description:
    'Guía sobre los requisitos de contraseña, cómo recuperar tu acceso y qué hacer si recibes demasiados intentos.',
};

const faqs = [
  {
    icon: KeyRound,
    question: '¿Por qué necesito mayúscula, minúscula y número?',
    answer: (
      <>
        <p>
          Las contraseñas con al menos una letra mayúscula, una minúscula y un número son
          significativamente más difíciles de descifrar por ataques automatizados. Una contraseña de
          8 caracteres con esta combinación tiene más de{' '}
          <strong>200 billones de combinaciones posibles</strong>, frente a solo 200 millones si usa
          únicamente letras minúsculas.
        </p>
        <p className="mt-2">Tu nueva contraseña debe cumplir todos estos requisitos:</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          <li>Mínimo 8 caracteres</li>
          <li>Al menos una letra mayúscula (A–Z)</li>
          <li>Al menos una letra minúscula (a–z)</li>
          <li>Al menos un número (0–9)</li>
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          Ejemplo válido: <code className="rounded bg-muted px-1 py-0.5">Taller2024!</code>
        </p>
      </>
    ),
  },
  {
    icon: Clock,
    question: '¿Por qué el enlace de recuperación expiró?',
    answer: (
      <>
        <p>
          Por seguridad, los enlaces de recuperación de contraseña son válidos durante{' '}
          <strong>solo 15 minutos</strong> desde que se solicitan. Esto limita la ventana de tiempo
          en que un enlace interceptado podría ser usado.
        </p>
        <p className="mt-2">
          Si el enlace ya expiró, regresa a la página de recuperación y solicita uno nuevo. El
          enlace anterior quedará automáticamente invalidado.
        </p>
        <div className="mt-3">
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Solicitar un nuevo enlace →
          </Link>
        </div>
      </>
    ),
  },
  {
    icon: ShieldCheck,
    question: '¿Por qué mi intento falló después de varios intentos?',
    answer: (
      <>
        <p>
          El sistema limita el número de solicitudes de recuperación a <strong>5 por hora</strong>{' '}
          para proteger las cuentas contra ataques automatizados. Si alcanzas ese límite, el botón
          se desactivará temporalmente.
        </p>
        <p className="mt-2">Qué hacer:</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          <li>Espera aproximadamente 1 hora antes de intentarlo nuevamente.</li>
          <li>Verifica que estás usando el email correcto asociado a tu cuenta.</li>
          <li>
            Si crees que alguien está intentando acceder a tu cuenta, contacta a tu administrador.
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: Lock,
    question: 'No recibí el email de recuperación, ¿qué hago?',
    answer: (
      <>
        <p>Si no ves el email en tu bandeja de entrada:</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
          <li>
            Revisa la carpeta de <strong>spam o correo no deseado</strong>.
          </li>
          <li>Verifica que ingresaste el email correcto.</li>
          <li>Espera 2-3 minutos — algunos proveedores de email pueden demorar la entrega.</li>
          <li>Solicita un nuevo enlace — el anterior quedará invalidado automáticamente.</li>
        </ol>
        <p className="mt-2 text-sm text-muted-foreground">
          Si el problema persiste, contacta al administrador del sistema.
        </p>
      </>
    ),
  },
];

export default function PasswordRecoveryHelpPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/login"
        className="mb-8 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio de sesión
      </Link>

      <header className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight">Ayuda — Recuperación de contraseña</h1>
        <p className="mt-2 text-muted-foreground">
          Preguntas frecuentes sobre el proceso de recuperación y los requisitos de contraseña.
        </p>
      </header>

      <div className="space-y-6">
        {faqs.map(({ icon: Icon, question, answer }) => (
          <section key={question} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold leading-snug">{question}</h2>
            </div>
            <div className="text-sm leading-relaxed text-muted-foreground">{answer}</div>
          </section>
        ))}
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        ¿Necesitas más ayuda? Contacta a tu administrador del sistema.
      </footer>
    </div>
  );
}

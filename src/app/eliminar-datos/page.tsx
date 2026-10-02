import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eliminación de datos | AVI Shopper',
  description: 'Cómo solicitar la eliminación de tus datos en AVI Shopper.',
};

const CONTACT = 'maravena@tooxs.com';

export default function EliminarDatosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-gray-800 leading-relaxed">
      <h1 className="text-3xl font-bold mb-6">Eliminación de datos</h1>

      <p className="mb-6">
        Puedes pedir que eliminemos todos los datos que AVI Shopper guarda sobre ti
        (cuenta, número de WhatsApp, mensajes, listas, preferencias e historial de compras).
      </p>

      <h2 className="text-xl font-semibold mb-2">Cómo solicitarlo</h2>
      <p className="mb-6">
        Escribe a <a className="underline" href={`mailto:${CONTACT}?subject=Eliminar%20mis%20datos%20AVI`}>{CONTACT}</a> con
        el asunto &quot;Eliminar mis datos AVI&quot;, indicando el correo o número de WhatsApp asociado a tu cuenta.
      </p>

      <h2 className="text-xl font-semibold mb-2">Qué pasa después</h2>
      <p className="mb-6">
        Confirmaremos la recepción de tu solicitud y eliminaremos tus datos en un plazo máximo de 30 días,
        salvo la información que debamos conservar por obligación legal. Te avisaremos cuando el proceso esté completo.
      </p>

      <p className="text-sm text-gray-500">
        Más información en nuestra <a className="underline" href="/privacidad">Política de Privacidad</a>.
      </p>
    </main>
  );
}

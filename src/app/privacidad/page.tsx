import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad | AVI Shopper',
  description: 'Cómo AVI Shopper recolecta, usa y protege tus datos.',
};

const UPDATED = '1 de octubre de 2026';
const CONTACT = 'maravena@tooxs.com';

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-gray-800 leading-relaxed">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
      <p className="text-sm text-gray-500 mb-8">Última actualización: {UPDATED}</p>

      <Section title="1. Quiénes somos">
        <p>
          AVI Shopper (&quot;AVI&quot;) es un asistente de compras desarrollado y operado por Tooxs, en Chile.
          Tooxs es responsable del tratamiento de los datos personales descritos en esta política.
          Contacto: <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Section>

      <Section title="2. Qué datos recolectamos">
        <ul className="list-disc pl-6 space-y-1">
          <li><b>Datos de cuenta:</b> nombre, correo electrónico y contraseña (cifrada) si te registras en la web.</li>
          <li><b>WhatsApp:</b> tu número de teléfono, nombre de perfil y el contenido de los mensajes que envías a AVI.</li>
          <li><b>Compras y preferencias:</b> listas de compra, productos, marcas, tiendas, presupuestos y el historial de compras que registras en AVI.</li>
          <li><b>Datos técnicos:</b> registros de uso, dirección IP y datos del navegador, para operar y asegurar el servicio.</li>
        </ul>
        <p className="mt-2">No recolectamos datos de tarjetas de pago. Los pagos, cuando existen, se realizan directamente en el sitio de cada tienda.</p>
      </Section>

      <Section title="3. Para qué usamos tus datos">
        <ul className="list-disc pl-6 space-y-1">
          <li>Responder tus mensajes y prestar el servicio de asistente de compras.</li>
          <li>Comparar precios, armar listas y generar enlaces de compra en tiendas.</li>
          <li>Personalizar recomendaciones según tus preferencias e historial.</li>
          <li>Enviarte avisos y recordatorios que hayas activado.</li>
          <li>Mantener la seguridad, prevenir abusos y mejorar el servicio.</li>
        </ul>
      </Section>

      <Section title="4. Con quién compartimos tus datos">
        <p>No vendemos tus datos. Solo los compartimos con proveedores necesarios para operar AVI:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><b>Meta Platforms (WhatsApp Business):</b> para enviar y recibir mensajes.</li>
          <li><b>Anthropic:</b> procesamiento de lenguaje (IA) para entender y responder tus mensajes.</li>
          <li><b>Vercel y Supabase:</b> alojamiento de la aplicación y base de datos.</li>
          <li><b>Tiendas y supermercados:</b> solo cuando tú eliges comprar, mediante enlaces a sus sitios.</li>
        </ul>
        <p className="mt-2">También podremos entregar datos cuando la ley lo exija.</p>
      </Section>

      <Section title="5. Cuánto tiempo los guardamos">
        <p>
          Conservamos tus datos mientras uses AVI. Si solicitas la eliminación o dejas de usar el servicio,
          los eliminamos dentro de 30 días, salvo lo que debamos conservar por obligación legal.
        </p>
      </Section>

      <Section title="6. Tus derechos">
        <p>
          Puedes solicitar acceso, rectificación, eliminación u oposición al tratamiento de tus datos,
          conforme a la Ley N° 19.628 sobre Protección de la Vida Privada y la normativa chilena aplicable.
          Revisa cómo hacerlo en <a className="underline" href="/eliminar-datos">/eliminar-datos</a> o
          escríbenos a <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Section>

      <Section title="7. Seguridad">
        <p>
          Usamos cifrado en tránsito (HTTPS), control de accesos y proveedores con estándares de seguridad reconocidos.
          Ningún sistema es 100% infalible; si detectamos un incidente que te afecte, te lo informaremos.
        </p>
      </Section>

      <Section title="8. Menores de edad">
        <p>AVI no está dirigido a menores de 18 años y no recolectamos sus datos de forma intencional.</p>
      </Section>

      <Section title="9. Cambios a esta política">
        <p>Si cambiamos esta política, publicaremos la nueva versión en esta página con su fecha de actualización.</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      {children}
    </section>
  );
}

import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
} from '@react-email/components';

export interface AllergenWarningProps {
  message: string;
  memberName: string;
}

export interface CartItemProps {
  name: string;
  quantity: number;
  unit: string;
  payable: number;
}

export interface CartProposedEmailProps {
  familyName: string;
  storeName: string;
  cartId: string;
  items: CartItemProps[];
  subtotal: number;
  allergenWarnings: AllergenWarningProps[];
  approveUrl: string;
  note?: string;
}

function formatClp(cents: number): string {
  return `$${Math.round(cents).toLocaleString('es-CL')}`;
}

export function CartProposedEmail({
  familyName,
  storeName,
  cartId,
  items,
  subtotal,
  allergenWarnings,
  approveUrl,
  note,
}: CartProposedEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>AVI propone un carro en {storeName} — revísalo y aprueba</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Text style={headerStyle}>🛒 AVI | SHOPPER</Text>
          <Text style={titleStyle}>
            Nuevo carro propuesto en <strong>{storeName}</strong>
          </Text>
          <Text style={subtitleStyle}>Para la familia {familyName}</Text>

          {allergenWarnings.length > 0 && (
            <Section style={allergenSectionStyle}>
              <Text style={allergenTitleStyle}>⚠️ Avisos de alérgenos</Text>
              {allergenWarnings.map((w, i) => (
                <Text key={i} style={allergenItemStyle}>
                  {w.message} — <strong>{w.memberName}</strong>
                </Text>
              ))}
            </Section>
          )}

          <Section style={itemsSectionStyle}>
            <Text style={sectionTitleStyle}>Productos ({items.length})</Text>
            {items.map((item, i) => (
              <Text key={i} style={itemStyle}>
                {item.quantity} {item.unit} × {item.name}
                {item.payable > 0 ? ` — ${formatClp(item.payable)}` : ''}
              </Text>
            ))}
            <Hr style={hrStyle} />
            <Text style={totalStyle}>
              Subtotal estimado: <strong>{formatClp(subtotal)}</strong>
            </Text>
          </Section>

          {note && (
            <Text style={noteStyle}>{note}</Text>
          )}

          <Section style={ctaSectionStyle}>
            <Button href={approveUrl} style={buttonStyle}>
              Revisar y aprobar
            </Button>
          </Section>

          <Text style={footerStyle}>
            AVI nunca paga ni hace checkout. Tú decides si se compra.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default CartProposedEmail;

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const containerStyle: React.CSSProperties = {
  maxWidth: '480px',
  margin: '0 auto',
  padding: '24px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
};

const headerStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#4F46E5',
  fontWeight: 700,
  letterSpacing: '0.5px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  color: '#0f172a',
  lineHeight: '1.4',
  margin: '8px 0 4px',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#64748b',
  margin: '0 0 16px',
};

const allergenSectionStyle: React.CSSProperties = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '16px',
  border: '1px solid #fbbf24',
};

const allergenTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#92400e',
  margin: '0 0 8px',
};

const allergenItemStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#92400e',
  margin: '4px 0',
  lineHeight: '1.4',
};

const itemsSectionStyle: React.CSSProperties = {
  marginBottom: '16px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#334155',
  margin: '0 0 8px',
};

const itemStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#475569',
  margin: '4px 0',
  lineHeight: '1.5',
};

const hrStyle: React.CSSProperties = {
  borderColor: '#e2e8f0',
  margin: '12px 0',
};

const totalStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#0f172a',
  textAlign: 'right' as const,
};

const noteStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#64748b',
  fontStyle: 'italic',
  marginBottom: '16px',
};

const ctaSectionStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  marginBottom: '16px',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#4F46E5',
  color: '#ffffff',
  padding: '12px 32px',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
};

const footerStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  textAlign: 'center' as const,
  marginTop: '8px',
};

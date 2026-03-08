import QRCode from 'qrcode';

function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, value: string): string {
  return id + value.length.toString().padStart(2, '0') + value;
}

/**
 * Gera o payload PIX (EMV QR Code) para pagamento estático
 */
export function gerarPixPayload(params: {
  chave: string;
  nome: string;
  cidade?: string;
  valor?: number;
  descricao?: string;
}): string {
  const { chave, nome, cidade = 'SAO PAULO', valor, descricao } = params;

  // Merchant Account Info (ID 26)
  let mai = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', chave);
  if (descricao) mai += tlv('02', descricao.substring(0, 25));

  let payload = '';
  payload += tlv('00', '01'); // Payload Format Indicator
  payload += tlv('26', mai); // Merchant Account Info
  payload += tlv('52', '0000'); // Merchant Category Code
  payload += tlv('53', '986'); // Transaction Currency (BRL)
  if (valor && valor > 0) {
    payload += tlv('54', valor.toFixed(2)); // Transaction Amount
  }
  payload += tlv('58', 'BR'); // Country Code
  payload += tlv('59', nome.substring(0, 25).toUpperCase()); // Merchant Name
  payload += tlv('60', cidade.substring(0, 15).toUpperCase()); // Merchant City
  payload += tlv('62', tlv('05', '***')); // Additional Data

  // CRC16 (ID 63) - precisa incluir "6304" antes de calcular
  payload += '6304';
  payload += crc16(payload);

  return payload;
}

/**
 * Gera QR Code como Data URL (base64 PNG)
 */
export async function gerarPixQrCodeDataUrl(params: {
  chave: string;
  nome: string;
  cidade?: string;
  valor?: number;
  descricao?: string;
}): Promise<string> {
  const payload = gerarPixPayload(params);
  return QRCode.toDataURL(payload, {
    width: 280,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

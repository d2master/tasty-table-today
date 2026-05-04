type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

interface GeneratePixPayloadParams {
  key: string;
  keyType: PixKeyType;
  recipientName: string;
  city: string;
  amount: number;
  txid: string;
  description?: string;
}

const normalizeText = (value: string, maxLength: number) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .,-]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, maxLength);

const normalizePixKey = (key: string, keyType: PixKeyType) => {
  const trimmedKey = key.trim();
  if (keyType === "cpf" || keyType === "cnpj") return trimmedKey.replace(/\D/g, "");
  if (keyType === "phone") {
    const digits = trimmedKey.replace(/\D/g, "");
    if (trimmedKey.startsWith("+")) return `+${digits}`;
    if (digits.startsWith("55")) return `+${digits}`;
    return `+55${digits}`;
  }
  return trimmedKey;
};

const formatEmvField = (id: string, value: string) =>
  `${id}${value.length.toString().padStart(2, "0")}${value}`;

const crc16 = (payload: string) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
};

export function generatePixPayload({
  key, keyType, recipientName, city, amount, txid, description,
}: GeneratePixPayloadParams) {
  const merchantAccountInfo = [
    formatEmvField("00", "BR.GOV.BCB.PIX"),
    formatEmvField("01", normalizePixKey(key, keyType)),
    ...(description ? [formatEmvField("02", normalizeText(description, 72))] : []),
  ].join("");

  const additionalData = formatEmvField("05", normalizeText(txid, 25) || "***");

  const payloadWithoutCrc = [
    formatEmvField("00", "01"),
    formatEmvField("01", "12"),
    formatEmvField("26", merchantAccountInfo),
    formatEmvField("52", "0000"),
    formatEmvField("53", "986"),
    formatEmvField("54", amount.toFixed(2)),
    formatEmvField("58", "BR"),
    formatEmvField("59", normalizeText(recipientName, 25)),
    formatEmvField("60", normalizeText(city, 15)),
    formatEmvField("62", additionalData),
    "6304",
  ].join("");

  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
}

// Cupom para impressora térmica (bobina 80mm).
// Gera um HTML monoespaçado e imprime através de um iframe oculto — assim
// funciona tanto no desktop quanto no Android sem abrir uma nova aba.

export interface ReceiptItem {
  product_name: string;
  quantity: number;
  price: number;
}

export interface ReceiptData {
  restaurantName: string;
  restaurantPhone?: string | null;
  orderId: string;
  createdAt: string;
  orderType?: string | null;
  tableNumber?: string | null;
  waiterName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  observation?: string | null;
  items: ReceiptItem[];
  tipEnabled?: boolean;
  tipAmount?: number;
  total: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  deliveryAddress?: string | null;
  deliveryMapsUrl?: string | null;
}

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  dinheiro: "Dinheiro",
};

const paymentStatusLabels: Record<string, string> = {
  pending: "Pendente",
  awaiting_pix: "Aguardando Pix",
  paid: "Pago",
  failed: "Falhou",
};

const money = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const shortOrderCode = (id: string) => id.replace(/-/g, "").slice(-6).toUpperCase();

export function buildReceiptHtml(data: ReceiptData): string {
  const isDelivery = data.orderType === "delivery";
  const subtotal = data.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const tip = Number(data.tipAmount ?? 0);

  const rows = data.items
    .map(
      (i) => `
    <div class="item">
      <div class="item-name">${i.quantity}x ${esc(i.product_name)}</div>
      <div class="item-row">
        <span>${money(Number(i.price))} un.</span>
        <span>${money(Number(i.price) * i.quantity)}</span>
      </div>
    </div>`,
    )
    .join("");

  const line = (label: string, value: string) =>
    `<div class="row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Pedido ${esc(shortOrderCode(data.orderId))}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body {
    width: 80mm;
    padding: 2mm 3mm 6mm;
    font-family: "Courier New", monospace;
    font-size: 12px;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
  }
  .center { text-align: center; }
  .big { font-size: 15px; font-weight: bold; }
  .bold { font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 2mm 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .row span:last-child { text-align: right; white-space: nowrap; }
  .item { margin-bottom: 1.2mm; }
  .item-name { font-weight: bold; word-break: break-word; }
  .item-row { display: flex; justify-content: space-between; font-size: 11px; }
  .total { font-size: 15px; font-weight: bold; }
  .obs { word-break: break-word; }
  .small { font-size: 10px; }
</style>
</head>
<body>
  <div class="center big">${esc(data.restaurantName)}</div>
  ${data.restaurantPhone ? `<div class="center small">Tel: ${esc(data.restaurantPhone)}</div>` : ""}
  <div class="sep"></div>
  <div class="row bold"><span>PEDIDO #${esc(shortOrderCode(data.orderId))}</span><span>${esc(
    new Date(data.createdAt).toLocaleString("pt-BR"),
  )}</span></div>
  <div class="bold">${isDelivery ? "DELIVERY" : `MESA ${esc(data.tableNumber || "-")}`}</div>
  ${data.waiterName ? line("Garçom", data.waiterName) : ""}
  ${data.customerName ? line("Cliente", data.customerName) : ""}
  ${data.customerPhone ? line("Telefone", data.customerPhone) : ""}
  <div class="sep"></div>
  ${rows || '<div class="small">Nenhum item</div>'}
  <div class="sep"></div>
  ${line("Subtotal", money(subtotal))}
  ${tip > 0 ? line("Taxa garçom (10%)", money(tip)) : ""}
  <div class="row total"><span>TOTAL</span><span>${money(data.total)}</span></div>
  <div class="sep"></div>
  ${data.paymentMethod ? line("Pagamento", paymentLabels[data.paymentMethod] || data.paymentMethod) : ""}
  ${data.paymentStatus ? line("Situação", paymentStatusLabels[data.paymentStatus] || data.paymentStatus) : ""}
  ${
    data.observation
      ? `<div class="sep"></div><div class="bold">OBSERVAÇÃO</div><div class="obs">${esc(data.observation)}</div>`
      : ""
  }
  ${
    isDelivery && (data.deliveryAddress || data.deliveryMapsUrl)
      ? `<div class="sep"></div><div class="bold">ENTREGA</div>${
          data.deliveryAddress ? `<div class="obs">${esc(data.deliveryAddress)}</div>` : ""
        }${data.deliveryMapsUrl ? `<div class="obs small">${esc(data.deliveryMapsUrl)}</div>` : ""}`
      : ""
  }
  <div class="sep"></div>
  <div class="center small">Obrigado pela preferência!</div>
  <div class="center small">${esc(data.restaurantName)}</div>
  <br />
</body>
</html>`;
}

export function printReceipt(data: ReceiptData): void {
  const html = buildReceiptHtml(data);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 2000);
  };

  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const run = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("print error", e);
    }
    cleanup();
  };

  // Aguarda o layout do iframe antes de mandar imprimir.
  if (doc.readyState === "complete") setTimeout(run, 150);
  else iframe.onload = () => setTimeout(run, 150);
}

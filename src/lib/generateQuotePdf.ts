import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Database } from '@/integrations/supabase/types';
import type { StoredPricingBreakdown, TollPlaza } from '@/lib/freightCalculator';

type Quote = Database['public']['Tables']['quotes']['Row'];

interface QuotePdfInput {
  quote: Quote;
  breakdown: StoredPricingBreakdown | null;
  vehicleName?: string | null;
  paymentTermLabel?: string | null;
  routeStops?: { city_uf: string; cep?: string | null; name?: string | null }[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtNum = (v: number, decimals = 0) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: decimals });

function loadLogo(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = () => resolve(null);
    img.src = '/brand/logo_vectra.jpg';
  });
}

export async function generateQuotePdf({
  quote,
  breakdown,
  vehicleName,
  paymentTermLabel,
  routeStops,
}: QuotePdfInput): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginL = 15;
  const marginR = 15;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 15;

  // ── Colors ──
  const primary: [number, number, number] = [30, 58, 95]; // dark blue
  const muted: [number, number, number] = [100, 116, 139];
  const black: [number, number, number] = [15, 23, 42];

  // ── Logo (square 1:1) ──
  const logoSize = 22; // mm — keeps aspect ratio for the square logo
  const logoData = await loadLogo();
  if (logoData) {
    doc.addImage(logoData, 'JPEG', marginL, y, logoSize, logoSize);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('VECTRA CARGO', marginL, y + 12);
  }

  // ── Title (vertically centered with logo) ──
  doc.setFontSize(18);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA COMERCIAL', pageWidth - marginR, y + 9, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.quote_code ?? '', pageWidth - marginR, y + 16, { align: 'right' });

  y += logoSize + 4;

  // ── Divider ──
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 6;

  // ── Date & validity ──
  const createdDate = new Date(quote.created_at).toLocaleDateString('pt-BR');
  const validityDate = quote.validity_date
    ? new Date(quote.validity_date).toLocaleDateString('pt-BR')
    : null;

  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Data: ${createdDate}`, marginL, y);
  if (validityDate) {
    doc.text(`Validade: ${validityDate}`, marginL + 60, y);
  }
  y += 8;

  // ── Client section ──
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', marginL, y);
  y += 5;

  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.client_name, marginL, y);
  y += 5;

  if (quote.client_email) {
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(quote.client_email as string, marginL, y);
    y += 5;
  }
  y += 3;

  // ── Route section ──
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text('ROTA', marginL, y);
  y += 6;

  const routeRows: string[][] = [];
  routeRows.push([
    'Origem',
    `${quote.origin}${quote.origin_cep ? ` (CEP: ${quote.origin_cep})` : ''}`,
  ]);

  if (routeStops && routeStops.length > 0) {
    routeStops.forEach((stop, i) => {
      routeRows.push([
        `Parada ${i + 1}`,
        `${stop.city_uf}${stop.cep ? ` (CEP: ${stop.cep})` : ''}${stop.name ? ` — ${stop.name}` : ''}`,
      ]);
    });
  }

  routeRows.push([
    'Destino',
    `${quote.destination}${quote.destination_cep ? ` (CEP: ${quote.destination_cep})` : ''}`,
  ]);

  if (quote.km_distance && Number(quote.km_distance) > 0) {
    routeRows.push(['Distância', `${fmtNum(Number(quote.km_distance))} km`]);
  }

  autoTable(doc, {
    startY: y,
    head: [],
    body: routeRows,
    theme: 'plain',
    margin: { left: marginL, right: marginR },
    styles: { fontSize: 9, cellPadding: 2, textColor: black },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35, textColor: muted },
      1: { cellWidth: contentWidth - 35 },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Operation section ──
  const opRows: string[][] = [];
  if (vehicleName) opRows.push(['Veículo', vehicleName]);
  if (quote.cargo_type) opRows.push(['Tipo de Carga', quote.cargo_type]);
  if (quote.weight && Number(quote.weight) > 0) {
    const w = Number(quote.weight);
    opRows.push(['Peso', w >= 1000 ? `${fmtNum(w / 1000, 2)} t` : `${fmtNum(w)} kg`]);
  }
  if (quote.volume && Number(quote.volume) > 0) {
    opRows.push(['Volume', `${fmtNum(Number(quote.volume), 2)} m³`]);
  }
  if (quote.cargo_value && Number(quote.cargo_value) > 0) {
    opRows.push(['Valor da Carga (NF)', fmt(Number(quote.cargo_value))]);
  }

  if (opRows.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('OPERAÇÃO', marginL, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [],
      body: opRows,
      theme: 'plain',
      margin: { left: marginL, right: marginR },
      styles: { fontSize: 9, cellPadding: 2, textColor: black },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45, textColor: muted },
        1: { cellWidth: contentWidth - 45 },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Pricing breakdown (client-facing) ──
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPOSIÇÃO DO FRETE', marginL, y);
  y += 6;

  const priceRows: [string, string][] = [];

  if (breakdown?.components) {
    const c = breakdown.components;
    if ((c.baseFreight ?? 0) > 0) priceRows.push(['Frete Base', fmt(c.baseFreight)]);
    if ((c.toll ?? 0) > 0) priceRows.push(['Pedágio', fmt(c.toll)]);
    if ((c.gris ?? 0) > 0)
      priceRows.push([`GRIS (${breakdown.rates?.grisPercent?.toFixed(2) ?? 0}%)`, fmt(c.gris)]);
    if ((c.tso ?? 0) > 0)
      priceRows.push([`TSO (${breakdown.rates?.tsoPercent?.toFixed(2) ?? 0}%)`, fmt(c.tso)]);
    if ((c.rctrc ?? 0) > 0)
      priceRows.push([
        `RCTR-C (${breakdown.rates?.costValuePercent?.toFixed(2) ?? 0}%)`,
        fmt(c.rctrc),
      ]);
    if ((c.adValorem ?? 0) > 0)
      priceRows.push([
        `Ad Valorem (${breakdown.rates?.adValoremPercent?.toFixed(3) ?? 0}%)`,
        fmt(c.adValorem),
      ]);
    if ((c.tde ?? 0) > 0) priceRows.push(['TDE', fmt(c.tde)]);
    if ((c.tear ?? 0) > 0) priceRows.push(['TEAR', fmt(c.tear)]);
    if ((c.dispatchFee ?? 0) > 0) priceRows.push(['Taxa de Despacho', fmt(c.dispatchFee)]);
    if ((c.aluguelMaquinas ?? 0) > 0)
      priceRows.push(['Aluguel de Máquinas', fmt(c.aluguelMaquinas)]);
    if ((c.waitingTimeCost ?? 0) > 0)
      priceRows.push(['Estadia / Hora Parada', fmt(c.waitingTimeCost)]);
    if ((c.conditionalFeesTotal ?? 0) > 0)
      priceRows.push(['Taxas Condicionais', fmt(c.conditionalFeesTotal)]);
  }

  if (breakdown?.profitability?.custosDescarga && breakdown.profitability.custosDescarga > 0) {
    priceRows.push(['Carga e Descarga', fmt(breakdown.profitability.custosDescarga)]);
  }

  const totalClienteBruto =
    breakdown?.totals?.totalCliente ?? (quote.value != null ? Number(quote.value) : 0);
  const discountValue = breakdown?.totals?.discount ?? 0;
  const totalCliente = Math.max(0, totalClienteBruto - discountValue);

  if (discountValue > 0) {
    priceRows.push(['(-) Desconto Comercial', `-${fmt(discountValue)}`]);
  }

  if (priceRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Item', 'Valor']],
      body: priceRows,
      foot: [['VALOR TOTAL', fmt(totalCliente)]],
      theme: 'striped',
      margin: { left: marginL, right: marginR },
      headStyles: {
        fillColor: primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: black },
      footStyles: {
        fillColor: [240, 245, 255],
        textColor: primary,
        fontStyle: 'bold',
        fontSize: 11,
      },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.65 },
        1: { cellWidth: contentWidth * 0.35, halign: 'right' },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  } else {
    // No breakdown — show just the total
    doc.setFontSize(14);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text(`Valor Total: ${fmt(totalCliente)}`, marginL, y);
    y += 10;
  }

  // ── Toll plazas ──
  const tollPlazas: TollPlaza[] = breakdown?.meta?.tollPlazas ?? [];
  if (tollPlazas.length > 0) {
    // Check if we need a new page
    if (y > 230) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(11);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('PEDÁGIOS DA ROTA', marginL, y);
    y += 6;

    const tollRows = tollPlazas.map((p, i) => [
      String(p.ordemPassagem || i + 1),
      p.nome,
      `${p.cidade}${p.uf ? ` - ${p.uf}` : ''}`,
      fmt(p.valorTag),
    ]);

    const tollTotal = tollPlazas.reduce((sum, p) => sum + p.valorTag, 0);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Praça', 'Cidade/UF', 'Valor (TAG)']],
      body: tollRows,
      foot: [['', '', `Total (${tollPlazas.length} praças)`, fmt(tollTotal)]],
      theme: 'striped',
      margin: { left: marginL, right: marginR },
      headStyles: {
        fillColor: primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8, textColor: black },
      footStyles: {
        fillColor: [240, 245, 255],
        textColor: primary,
        fontStyle: 'bold',
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        3: { halign: 'right' },
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Payment terms ──
  if (paymentTermLabel) {
    if (y > 260) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(11);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('CONDIÇÕES DE PAGAMENTO', marginL, y);
    y += 6;

    doc.setFontSize(10);
    doc.setTextColor(...black);
    doc.setFont('helvetica', 'normal');
    doc.text(paymentTermLabel, marginL, y);
    y += 8;
  }

  // ── Delivery notes ──
  if (quote.delivery_notes) {
    if (y > 250) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(11);
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', marginL, y);
    y += 6;

    doc.setFontSize(9);
    doc.setTextColor(...black);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(quote.delivery_notes as string, contentWidth);
    doc.text(lines, marginL, y);
    y += lines.length * 4 + 4;
  }

  // ── Notes ──
  if (quote.notes) {
    if (y > 250) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(String(quote.notes), contentWidth);
    doc.text(noteLines, marginL, y);
    y += noteLines.length * 4 + 4;
  }

  // ── Footer on all pages ──
  const pageCount = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 15, pageWidth - marginR, pageH - 15);

    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.text('Vectra Cargo — Transporte e Logística', marginL, pageH - 10);
    doc.text(`Página ${i}/${pageCount}`, pageWidth - marginR, pageH - 10, { align: 'right' });

    doc.setFontSize(6);
    doc.text(
      'Este documento é uma proposta comercial e não constitui contrato. Valores sujeitos à confirmação.',
      marginL,
      pageH - 6
    );
  }

  // ── Download ──
  const filename = `${(quote.quote_code ?? 'cotacao').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

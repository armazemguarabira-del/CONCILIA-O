import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PdfExportOptions {
  fileName?: string;
  orientation?: 'portrait' | 'landscape';
  title?: string;
  subtitle?: string;
  depositoName?: string;
  periodo?: string;
}

/**
 * Exporta elementos HTML para PDF institucional Ambev com alta definição (2x scale),
 * diagramação simétrica perfeita, eliminação de cortes de colunas laterais e
 * paginação inteligente que nunca divide linhas de tabela ou blocos ao meio.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    fileName = 'relatorio-quebras-ambev.pdf',
    orientation = 'portrait',
    title = 'RELATÓRIO OFICIAL DE QUEBRAS & AVARIAS',
    subtitle = 'Sistema de Gestão de Estoque & DPO Ambev',
    depositoName = 'Depósito Geral / CDD',
    periodo = 'Período Vigente',
  } = options;

  const isLandscape = orientation === 'landscape';
  // Largura de renderização calibrada para que tabelas com 13+ colunas caibam 100%
  const renderWidthPx = isLandscape ? 1340 : 960;

  // Cria um container temporário estilizado para impressão executiva
  const printWrapper = document.createElement('div');
  printWrapper.style.position = 'fixed';
  printWrapper.style.left = '-9999px';
  printWrapper.style.top = '0';
  printWrapper.style.width = `${renderWidthPx}px`;
  printWrapper.style.minWidth = `${renderWidthPx}px`;
  printWrapper.style.maxWidth = `${renderWidthPx}px`;
  printWrapper.style.backgroundColor = '#ffffff';
  printWrapper.style.color = '#0f172a';
  printWrapper.style.padding = '20px 24px';
  printWrapper.style.boxSizing = 'border-box';
  printWrapper.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  printWrapper.style.zIndex = '-9999';

  // Cabeçalho institucional no topo do PDF
  const nowStr = new Date().toLocaleString('pt-BR');
  const headerHtml = `
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.05em; color: #059669; text-transform: uppercase; margin-bottom: 2px;">
          AMBEV S.A. • OPERAÇÕES LOGÍSTICAS & CONTROLE DE ESTOQUE (DPO)
        </div>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">
          ${title}
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
          ${subtitle}
        </div>
      </div>
      <div style="text-align: right; font-size: 10px; color: #475569; font-family: monospace;">
        <div><strong>Depósito:</strong> ${depositoName}</div>
        <div><strong>Filtro:</strong> ${periodo}</div>
        <div><strong>Emissão:</strong> ${nowStr}</div>
      </div>
    </div>
  `;

  // Estilo embutido para garantir simetria, remoção de rolagem/corte e ajuste perfeito das colunas
  const styleBlock = document.createElement('style');
  styleBlock.textContent = `
    * {
      box-sizing: border-box !important;
    }
    /* Elimina qualquer corte ou rolagem horizontal */
    .overflow-x-auto, .overflow-y-auto, .overflow-hidden, .overflow-scroll, [class*="overflow-"] {
      overflow: visible !important;
      max-width: none !important;
      width: 100% !important;
    }
    /* Tabelas sempre 100% simétricas */
    table {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: auto !important;
      border-collapse: collapse !important;
      margin: 0 !important;
    }
    /* Ajuste fino dos cabeçalhos das colunas */
    th {
      font-size: 8px !important;
      padding: 5px 3px !important;
      line-height: 1.15 !important;
      white-space: nowrap !important;
    }
    /* Ajuste fino do corpo das células */
    td {
      font-size: 8px !important;
      padding: 4px 3px !important;
      line-height: 1.25 !important;
    }
    /* Coluna de Descrição: permite quebra de linha harmoniosa sem estourar a tabela */
    table th:nth-child(4), table td:nth-child(4) {
      white-space: normal !important;
      word-break: break-word !important;
      min-width: 120px !important;
      max-width: 220px !important;
    }
    /* Colunas numéricas */
    td.font-mono {
      letter-spacing: -0.01em !important;
    }
    /* Badges com visual compacto */
    span.rounded, span[class*="rounded"] {
      padding: 1px 4px !important;
      font-size: 8px !important;
      display: inline-block !important;
    }
  `;

  const clonedNode = element.cloneNode(true) as HTMLElement;

  // Remove botões de ação e interações que não devem sair no PDF impresso
  const interactiveButtons = clonedNode.querySelectorAll('button, input, select, .no-print');
  interactiveButtons.forEach((btn) => {
    (btn as HTMLElement).style.display = 'none';
  });

  printWrapper.appendChild(styleBlock);
  printWrapper.insertAdjacentHTML('beforeend', headerHtml);
  printWrapper.appendChild(clonedNode);

  document.body.appendChild(printWrapper);

  try {
    // Coleta as posições verticais relativas de todas as linhas de tabela e blocos visuais
    // para garantir que NENHUMA LINHA SEJA CORTADA NA PAGINAÇÃO
    const wrapperRect = printWrapper.getBoundingClientRect();
    const breakAvoidElements = Array.from(
      printWrapper.querySelectorAll('tr, .rounded-xl, .border, .grid')
    ) as HTMLElement[];

    const boundaries = breakAvoidElements.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top - wrapperRect.top,
        bottom: r.bottom - wrapperRect.top,
      };
    });

    // Renderiza em alta resolução com o html2canvas-pro
    const canvas = await html2canvas(printWrapper, {
      scale: 2, // Resolução 2x para nitidez de texto e gráficos
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: renderWidthPx,
    });

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    // Margens simétricas
    const marginMm = 8;
    const footerMarginMm = 8; // Espaço reservado para o rodapé em todas as páginas
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const contentHeightMm = pageHeightMm - marginMm - footerMarginMm;

    // Fator de escala entre o canvas em pixels e o PDF em mm
    const scale = canvas.width / renderWidthPx;
    // Altura máxima que cabe em cada página do PDF (em pixels do canvas)
    const pageCanvasMaxHeight = Math.floor((contentHeightMm / contentWidthMm) * canvas.width);

    let currentCanvasY = 0;
    let pageIndex = 0;

    // Paginação inteligente linha por linha
    while (currentCanvasY < canvas.height - 4) {
      let targetCanvasY = currentCanvasY + pageCanvasMaxHeight;

      if (targetCanvasY >= canvas.height) {
        targetCanvasY = canvas.height;
      } else {
        // Converte a altura alvo para as coordenadas do DOM
        const targetWrapperY = targetCanvasY / scale;

        // Procura se alguma linha de tabela ou bloco cruza essa fronteira
        const straddling = boundaries.find(
          (b) => b.top < targetWrapperY - 2 && b.bottom > targetWrapperY + 2
        );

        if (straddling) {
          const cutCandidateCanvasY = Math.floor(straddling.top * scale);
          // Garante que o corte não seja muito próximo do topo atual
          if (cutCandidateCanvasY > currentCanvasY + 80) {
            targetCanvasY = cutCandidateCanvasY;
          }
        }
      }

      const sliceHeight = targetCanvasY - currentCanvasY;
      if (sliceHeight <= 0) break;

      // Cria um canvas dedicado para esta fatia de página
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          currentCanvasY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        const sliceImgData = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = (sliceHeight * contentWidthMm) / canvas.width;

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          sliceImgData,
          'PNG',
          marginMm,
          marginMm,
          contentWidthMm,
          sliceHeightMm,
          undefined,
          'FAST'
        );
      }

      currentCanvasY = targetCanvasY;
      pageIndex++;
    }

    // Adiciona o rodapé institucional com numeração simétrica em todas as páginas
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139); // Slate-500
      const footerText = `Página ${i} de ${totalPages} • Ambev DPO / Logística • Documento Oficial de Quebras e Avarias`;
      pdf.text(footerText, pageWidthMm / 2, pageHeightMm - 3.5, { align: 'center' });
    }

    pdf.save(fileName);
  } finally {
    if (document.body.contains(printWrapper)) {
      document.body.removeChild(printWrapper);
    }
  }
}

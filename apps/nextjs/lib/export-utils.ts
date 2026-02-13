import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { BrandVoice } from '@/types';

// ── Helpers ──────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Text Export ──────────────────────────────────────────────

export function brandVoiceToText(bv: BrandVoice): string {
  const lines: string[] = [];
  const hr = '────────────────────────────────────────';

  lines.push(bv.brandName.toUpperCase());
  lines.push(hr);
  lines.push('');

  // Summary
  lines.push(bv.summary);
  lines.push('');

  // Personality
  if (bv.personality) {
    lines.push('BRAND PERSONALITY');
    lines.push(hr);
    lines.push(`Archetype: ${bv.personality.archetype}`);
    lines.push(bv.personality.description);
    lines.push('');
  }

  // Tone Attributes
  if (bv.toneAttributes?.length > 0) {
    lines.push('TONE ATTRIBUTES');
    lines.push(hr);
    for (const attr of bv.toneAttributes) {
      lines.push(`• ${attr.name}`);
      if (attr.description) lines.push(`  ${attr.description}`);
    }
    lines.push('');
  }

  // Vocabulary
  if (bv.vocabulary?.length > 0) {
    lines.push('VOCABULARY');
    lines.push(hr);
    for (const cat of bv.vocabulary) {
      lines.push(`${cat.category}:`);
      lines.push(`  ${cat.terms.join(', ')}`);
    }
    lines.push('');
  }

  // Writing Style
  if (bv.writingStyle?.length > 0) {
    lines.push('WRITING STYLE');
    lines.push(hr);
    for (let i = 0; i < bv.writingStyle.length; i++) {
      const rule = bv.writingStyle[i];
      lines.push(`${i + 1}. ${rule.rule}`);
      if (rule.description) lines.push(`   ${rule.description}`);
    }
    lines.push('');
  }

  // Avoidances
  if (bv.avoidances?.length > 0) {
    lines.push('AVOIDANCES');
    lines.push(hr);
    for (const rule of bv.avoidances) {
      lines.push(`• ${rule.rule}`);
      if (rule.description) lines.push(`  ${rule.description}`);
    }
    lines.push('');
  }

  // Writing Direction
  if (bv.writingDirection) {
    lines.push('WRITING DIRECTION');
    lines.push(hr);
    lines.push(bv.writingDirection);
    lines.push('');
  }

  // Target Audience
  if (bv.targetAudience) {
    lines.push('TARGET AUDIENCE');
    lines.push(hr);
    lines.push(bv.targetAudience);
    lines.push('');
  }

  // Unique Selling Points
  if (bv.uniqueSellingPoints?.length > 0) {
    lines.push('WHAT SETS THEM APART');
    lines.push(hr);
    for (let i = 0; i < bv.uniqueSellingPoints.length; i++) {
      lines.push(`${i + 1}. ${bv.uniqueSellingPoints[i]}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadBrandVoiceAsText(bv: BrandVoice): void {
  const text = brandVoiceToText(bv);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${slugify(bv.brandName)}-brand-voice.txt`);
}

// ── PDF Export ───────────────────────────────────────────────

export function downloadBrandVoiceAsPdf(bv: BrandVoice): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const colors = {
    title: [30, 41, 59] as [number, number, number],       // slate-800
    heading: [51, 65, 85] as [number, number, number],      // slate-700
    body: [71, 85, 105] as [number, number, number],        // slate-500
    muted: [148, 163, 184] as [number, number, number],     // slate-400
    accent: [59, 130, 246] as [number, number, number],     // blue-500
    line: [226, 232, 240] as [number, number, number],      // slate-200
  };

  function checkPage(needed: number): void {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function addTitle(text: string): void {
    checkPage(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...colors.title);
    doc.text(text, margin, y);
    y += 10;
    // Accent underline
    doc.setDrawColor(...colors.accent);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + 40, y);
    y += 10;
  }

  function addHeading(text: string): void {
    checkPage(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...colors.heading);
    doc.text(text.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(...colors.line);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  }

  function addBody(text: string, indent = 0): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...colors.body);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, margin + indent, y);
      y += 5;
    }
  }

  function addBullet(label: string, description?: string): void {
    checkPage(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...colors.heading);
    doc.text('•', margin + 2, y);
    doc.text(label, margin + 7, y);
    y += 5;
    if (description) {
      addBody(description, 7);
    }
  }

  function addNumbered(index: number, label: string, description?: string): void {
    checkPage(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...colors.heading);
    doc.text(`${index}.`, margin + 2, y);
    doc.text(label, margin + 9, y);
    y += 5;
    if (description) {
      addBody(description, 9);
    }
  }

  function addSpacer(size = 6): void {
    y += size;
  }

  // ── Build PDF ────────────────────────────────────────────

  addTitle(bv.brandName);
  addBody(bv.summary);
  addSpacer(8);

  // Personality
  if (bv.personality) {
    addHeading('Brand Personality');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...colors.accent);
    doc.text(bv.personality.archetype, margin, y);
    y += 5;
    addBody(bv.personality.description);
    addSpacer();
  }

  // Tone Attributes
  if (bv.toneAttributes?.length > 0) {
    addHeading('Tone Attributes');
    for (const attr of bv.toneAttributes) {
      addBullet(attr.name, attr.description);
    }
    addSpacer();
  }

  // Vocabulary
  if (bv.vocabulary?.length > 0) {
    addHeading('Vocabulary');
    for (const cat of bv.vocabulary) {
      checkPage(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colors.heading);
      doc.text(cat.category, margin + 2, y);
      y += 5;
      addBody(cat.terms.join(', '), 2);
      y += 2;
    }
    addSpacer();
  }

  // Writing Style
  if (bv.writingStyle?.length > 0) {
    addHeading('Writing Style');
    for (let i = 0; i < bv.writingStyle.length; i++) {
      const rule = bv.writingStyle[i];
      addNumbered(i + 1, rule.rule, rule.description);
    }
    addSpacer();
  }

  // Avoidances
  if (bv.avoidances?.length > 0) {
    addHeading('Avoidances');
    for (const rule of bv.avoidances) {
      addBullet(rule.rule, rule.description);
    }
    addSpacer();
  }

  // Writing Direction
  if (bv.writingDirection) {
    addHeading('Writing Direction');
    addBody(bv.writingDirection);
    addSpacer();
  }

  // Target Audience
  if (bv.targetAudience) {
    addHeading('Target Audience');
    addBody(bv.targetAudience);
    addSpacer();
  }

  // USPs
  if (bv.uniqueSellingPoints?.length > 0) {
    addHeading('What Sets Them Apart');
    for (let i = 0; i < bv.uniqueSellingPoints.length; i++) {
      addNumbered(i + 1, bv.uniqueSellingPoints[i]);
    }
  }

  doc.save(`${slugify(bv.brandName)}-brand-voice.pdf`);
}

// ── PDF Snapshot Export (HTML-to-canvas) ─────────────────────

export async function downloadBrandVoiceAsSnapshot(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  // Render the DOM element to a high-res canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidthPx = canvas.width;
  const imgHeightPx = canvas.height;

  // A4 dimensions in mm
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const margin = 10;
  const contentWidthMm = pageWidthMm - margin * 2;
  const contentHeightMm = pageHeightMm - margin * 2;

  // Scale image to fit the content width
  const ratio = contentWidthMm / imgWidthPx;
  const scaledHeightMm = imgHeightPx * ratio;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  if (scaledHeightMm <= contentHeightMm) {
    // Fits on a single page
    doc.addImage(imgData, 'PNG', margin, margin, contentWidthMm, scaledHeightMm);
  } else {
    // Split across multiple pages by slicing the source canvas
    let srcYOffset = 0;
    const pageContentHeightPx = contentHeightMm / ratio;
    let isFirstPage = true;

    while (srcYOffset < imgHeightPx) {
      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      const sliceHeight = Math.min(pageContentHeightPx, imgHeightPx - srcYOffset);
      const sliceHeightMm = sliceHeight * ratio;

      // Create a canvas slice for this page
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgWidthPx;
      sliceCanvas.height = sliceHeight;
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          canvas,
          0, srcYOffset, imgWidthPx, sliceHeight,
          0, 0, imgWidthPx, sliceHeight,
        );
      }

      const sliceData = sliceCanvas.toDataURL('image/png');
      doc.addImage(sliceData, 'PNG', margin, margin, contentWidthMm, sliceHeightMm);

      srcYOffset += sliceHeight;
    }
  }

  doc.save(filename);
}

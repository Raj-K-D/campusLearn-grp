const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_PDF_TEXT_LENGTH = 100000;

export async function extractPdfText(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.byteLength > MAX_PDF_BYTES) {
        throw new Error('PDFs must be 15 MB or smaller.');
    }

    const [pdfjsLib, worker] = await Promise.all([
        import ('pdfjs-dist/legacy/build/pdf.mjs'),
        import ('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    if (pdf.numPages > 120) {
        throw new Error('PDFs are limited to 120 pages.');
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => (typeof item.str === 'string' ? item.str : '')).join(' '));
    }

    const text = pages.join('\n').trim();
    if (!text) {
        throw new Error('This PDF has no selectable text. Scanned PDFs need OCR before Gooloogulu can read them.');
    }
    if (text.length > MAX_PDF_TEXT_LENGTH) {
        throw new Error('This PDF contains too much text to summarize in one request.');
    }
    return text;
}
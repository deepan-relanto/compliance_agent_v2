import { readFileSync } from "fs";
import path from "path";

export interface CertificateData {
  courseName: string;
  /** PNG data URL of the learner's electronic signature. */
  digitalSignature: string;
  /** Month and year label, e.g. "June 2026". */
  dateLabel: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadLogoDataUrl(): string {
  const logoPath = path.join(process.cwd(), "public", "images", "relanto-logo.png");
  const buffer = readFileSync(logoPath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

/** Build certificate HTML matching the Relanto completion template. */
export function buildCertificateHtml(data: CertificateData): string {
  const logoSrc = loadLogoDataUrl();
  const courseName = escapeHtml(data.courseName);
  const dateLabel = escapeHtml(data.dateLabel);
  const signatureSrc = data.digitalSignature;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relanto Certificate of Completion</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --dark-blue: #1c2045;
            --brand-orange: #e54e24;
            --text-grey: #333333;
            --gold: #d4af37;
        }

        * { box-sizing: border-box; }

        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #ffffff;
            margin: 0;
            font-family: 'Montserrat', sans-serif;
        }

        .certificate-container {
            position: relative;
            width: 1000px;
            height: 700px;
            background-color: #ffffff;
            background-image: radial-gradient(circle at 50% 50%, #ffffff 0%, #f8f9fa 50%, #f1f2f6 100%);
            overflow: hidden;
            border: 2px solid #e0e0e0;
        }

        .shape {
            position: absolute;
            z-index: 1;
        }

        .top-shapes {
            top: 0;
            right: 0;
            width: 450px;
            height: 250px;
        }

        .bottom-shapes {
            bottom: 0;
            left: 0;
            width: 450px;
            height: 200px;
        }

        .gold-seal {
            position: absolute;
            top: 30px;
            right: 40px;
            width: 120px;
            height: 120px;
            z-index: 2;
        }

        .content {
            position: relative;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 50px;
            height: 100%;
        }

        .logo {
            align-self: flex-start;
            height: 60px;
            margin-bottom: 30px;
        }

        .title {
            font-family: 'Playfair Display', serif;
            font-size: 52px;
            color: var(--dark-blue);
            margin: 0;
            letter-spacing: 2px;
            font-weight: 600;
        }

        .subtitle {
            font-family: 'Playfair Display', serif;
            font-size: 20px;
            color: var(--dark-blue);
            margin: 10px 0 40px 0;
            letter-spacing: 4px;
            font-weight: 600;
        }

        .presented-text {
            font-size: 18px;
            color: var(--text-grey);
            margin: 0 0 20px 0;
        }

        .recipient-signature {
            display: block;
            max-height: 90px;
            max-width: 520px;
            width: auto;
            margin: 0 auto 20px auto;
            object-fit: contain;
        }

        .reason-text {
            font-size: 18px;
            color: var(--text-grey);
            margin: 0 0 10px 0;
        }

        .course-name {
            font-size: 24px;
            color: var(--dark-blue);
            margin: 0 0 15px 0;
            font-weight: 600;
        }

        .date-text {
            font-size: 16px;
            color: var(--text-grey);
            margin: 0;
        }

        .signature-section {
            position: absolute;
            bottom: 50px;
            right: 70px;
            text-align: center;
            z-index: 10;
        }

        .signature-line {
            width: 200px;
            height: 1px;
            background-color: var(--dark-blue);
            margin-bottom: 8px;
        }

        .signature-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--dark-blue);
            margin: 0 0 3px 0;
        }

        .signature-title {
            font-size: 12px;
            color: var(--text-grey);
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <svg class="shape top-shapes" viewBox="0 0 450 250" xmlns="http://www.w3.org/2000/svg">
            <path d="M150,0 C250,50 300,180 450,200 L450,0 Z" fill="#e54e24" />
            <path d="M0,0 C150,80 250,250 450,250 L450,0 Z" fill="#1c2045" />
        </svg>

        <svg class="shape bottom-shapes" viewBox="0 0 450 200" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,200 C100,100 200,50 450,200 Z" fill="#1c2045" />
            <path d="M0,200 C50,150 150,160 250,200 Z" fill="#e54e24" />
        </svg>

        <svg class="gold-seal" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M30,70 L20,115 L35,105 L50,115 Z" fill="#c59b27" />
            <path d="M70,70 L80,115 L65,105 L50,115 Z" fill="#c59b27" />
            <circle cx="50" cy="50" r="35" fill="#d4af37" />
            <path d="M50,10 L54,18 L62,15 L63,24 L72,25 L70,33 L78,38 L74,45 L81,50 L74,55 L78,62 L70,67 L72,75 L63,76 L62,85 L54,82 L50,90 L46,82 L38,85 L37,76 L28,75 L30,67 L22,62 L26,55 L19,50 L26,45 L22,38 L30,33 L28,25 L37,24 L38,15 L46,18 Z" fill="#e8c651" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="#b0861a" stroke-width="2" />
            <circle cx="50" cy="50" r="24" fill="none" stroke="#ffe58f" stroke-width="1" />
        </svg>

        <div class="content">
            <img src="${logoSrc}" alt="Relanto Reimagining AI" class="logo">

            <h1 class="title">CERTIFICATE</h1>
            <h2 class="subtitle">OF COMPLETION</h2>

            <p class="presented-text">This certificate is presented to</p>

            <img src="${signatureSrc}" alt="Electronic signature" class="recipient-signature">

            <p class="reason-text">for completing training in</p>

            <h4 class="course-name">${courseName}</h4>

            <p class="date-text">conducted in <span>${dateLabel}</span></p>
        </div>

        <div class="signature-section">
            <div class="signature-line"></div>
            <p class="signature-name">T.P. Vincent</p>
            <p class="signature-title">Chief Technology Officer</p>
        </div>
    </div>
</body>
</html>`;
}

export function formatCertificateDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Render the certificate HTML to a PDF buffer (1000×700 layout). */
export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const html = buildCertificateHtml(data);
  const puppeteer = await import("puppeteer");

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);

    const pdfBytes = await page.pdf({
      width: "1000px",
      height: "700px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

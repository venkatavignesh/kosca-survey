import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// 1×1 transparent PNG (smallest possible). Base64-decoded once at module load.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

// Email-open tracking pixel.
//
// Embedded at the bottom of every campaign invitation email as
// <img src="…/api/track/open/<token>" width="1" height="1" alt="">.
// On first hit per assignment we set `emailOpenedAt`; subsequent hits
// (re-renders, image-proxy refreshes, forwards) are intentionally
// no-ops so the timestamp records the FIRST open.
//
// Caveats — be aware these affect open-rate accuracy:
//   • Outlook desktop blocks remote images by default; tracker fires only
//     when the recipient clicks "Download images".
//   • Apple Mail Privacy Protection (iOS 15+, macOS 12+) pre-fetches all
//     remote content shortly after delivery, so every Apple Mail open
//     registers immediately on arrival regardless of the user reading it.
//   • Corporate proxies (e.g. Mimecast, Barracuda) may also pre-fetch.
// Treat "opened" as a soft signal, not a hard one.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  // updateMany so missing token / already-set rows are silent no-ops.
  await prisma.campaignAssignment
    .updateMany({
      where: { token, emailOpenedAt: null },
      data: { emailOpenedAt: new Date() },
    })
    .catch(() => {
      /* never let a tracker hit break the image response */
    });

  return new Response(PIXEL as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

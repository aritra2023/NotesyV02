import { Router } from "express";

const router = Router();

interface VideoResult {
  id: string;
  title: string;
  url: string;
  channel: string;
  views: string;
  duration: string;
}

async function scrapeYouTube(query: string): Promise<VideoResult[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const html = await res.text();
  const marker = "var ytInitialData = ";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return [];

  const jsonStart = startIdx + marker.length;
  const endIdx = html.indexOf(";</script>", jsonStart);
  if (endIdx === -1) return [];

  const data = JSON.parse(html.slice(jsonStart, endIdx)) as {
    contents?: {
      twoColumnSearchResultsRenderer?: {
        primaryContents?: {
          sectionListRenderer?: {
            contents?: Array<{
              itemSectionRenderer?: {
                contents?: Array<{
                  videoRenderer?: {
                    videoId?: string;
                    title?: { runs?: Array<{ text?: string }> };
                    ownerText?: { runs?: Array<{ text?: string }> };
                    longBylineText?: { runs?: Array<{ text?: string }> };
                    viewCountText?: { simpleText?: string };
                    shortViewCountText?: { simpleText?: string };
                    lengthText?: { simpleText?: string };
                  };
                }>;
              };
            }>;
          };
        };
      };
    };
  };

  const contents =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

  const videos: VideoResult[] = [];
  for (const item of contents) {
    const v = item.videoRenderer;
    if (!v?.videoId) continue;
    videos.push({
      id: v.videoId,
      title: v.title?.runs?.[0]?.text ?? "Untitled",
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      channel: v.ownerText?.runs?.[0]?.text ?? v.longBylineText?.runs?.[0]?.text ?? "",
      views: v.viewCountText?.simpleText ?? v.shortViewCountText?.simpleText ?? "",
      duration: v.lengthText?.simpleText ?? "",
    });
    if (videos.length >= 5) break;
  }
  return videos;
}

router.get("/youtube-search", async (req, res) => {
  const query = String(req.query["q"] ?? "").trim();
  if (!query) {
    res.status(400).json({ error: "Query required" });
    return;
  }
  try {
    const videos = await scrapeYouTube(query);
    res.json({ videos });
  } catch (err) {
    req.log.error({ err }, "YouTube scrape failed");
    res.status(500).json({ error: "YouTube search failed", videos: [] });
  }
});

export default router;

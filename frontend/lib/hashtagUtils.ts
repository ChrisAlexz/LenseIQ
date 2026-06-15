import hashtagData from './hashtags.json';


export function generateHashtags(sport: string): string {
  
  const data: any = hashtagData as any;
  const tags = data?.[sport];
  const globalTags = data?._global || [];
  if (!Array.isArray(tags) || tags.length === 0) {
    return "#sports #viral #reels #highlights #fyp #trending #explore #shorts";
  }

  const pickN = (arr: string[], n: number) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(n, shuffled.length));
  };

  const sportSelected = pickN(tags, 6);
  const globalSelected = pickN(globalTags, 6);

  const uniq = new Set<string>();
  const out: string[] = [];
  [...sportSelected, ...globalSelected].forEach((tag) => {
    const cleaned = String(tag || "").trim().replace(/^#/, "");
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (uniq.has(key)) return;
    uniq.add(key);
    out.push(`#${cleaned}`);
  });

  // Always include #LENSEIQ
  if (!uniq.has("lenseiq")) {
    out.push("#LENSEIQ");
  }
  return out.join(" ");
}

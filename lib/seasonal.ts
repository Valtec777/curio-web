export type SeasonalBand = "1-3" | "4-5" | "6-8";

export type SeasonalEvent = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  decorations: string[];
  mission: Record<SeasonalBand, string>;
};

export function getSeasonalEvent(): SeasonalEvent | null {
  return null;
}

export function getGradeBand(gradeName?: string | null): SeasonalBand {
  const grade = Number(gradeName?.match(/\d+/)?.[0] || 0);
  if (grade >= 6) return "6-8";
  if (grade >= 4) return "4-5";
  return "1-3";
}

export function getSeasonalExperience() {
  return null;
}

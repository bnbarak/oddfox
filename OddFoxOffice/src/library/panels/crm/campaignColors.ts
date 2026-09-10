/* A stable colour per campaign.

   Derived from the id rather than stored, so a new campaign has a colour the
   moment it exists and nobody has to pick one. The hue is the only thing that
   varies: saturation and lightness are fixed at values that hold their
   contrast on this background, because the failure mode of generated colour
   is dark text on a dark fill, and a campaign label you cannot read is worse
   than no colour at all. */

const hueOf = (id: string): number => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
};

export const campaignColors = (id: string) => {
  const h = hueOf(id);
  return {
    background: `hsl(${h} 42% 17%)`,
    color: `hsl(${h} 70% 78%)`,
    borderColor: `hsl(${h} 40% 32%)`,
  };
};

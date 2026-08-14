import type { Card, Rarity } from "./types";

const cardImages = import.meta.glob("../assets/cards/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function imageFor(slug: string): string | undefined {
  const entry = Object.entries(cardImages).find(([path]) => path.endsWith(`/${slug}.jpg`));
  return entry?.[1];
}

interface CreatureData {
  name: string;
  rarity: Rarity;
  tier: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const CREATURES: CreatureData[] = [
  { name: "Giant Rat", rarity: "Common", tier: 1, top: 2, right: 3, bottom: 2, left: 2 },
  { name: "Skeleton", rarity: "Common", tier: 1, top: 3, right: 2, bottom: 3, left: 2 },
  { name: "Sprite", rarity: "Common", tier: 1, top: 4, right: 2, bottom: 2, left: 3 },
  { name: "Zombie", rarity: "Common", tier: 1, top: 2, right: 2, bottom: 4, left: 3 },
  { name: "Slime", rarity: "Common", tier: 1, top: 3, right: 4, bottom: 2, left: 2 },
  { name: "Kobold", rarity: "Common", tier: 1, top: 2, right: 5, bottom: 2, left: 2 },
  { name: "Cave Bat", rarity: "Common", tier: 1, top: 4, right: 3, bottom: 2, left: 3 },
  { name: "Goblin", rarity: "Common", tier: 1, top: 2, right: 5, bottom: 3, left: 2 },
  { name: "Imp", rarity: "Common", tier: 1, top: 5, right: 2, bottom: 3, left: 3 },
  { name: "Gremlin", rarity: "Common", tier: 1, top: 3, right: 3, bottom: 5, left: 2 },
  { name: "Orc", rarity: "Uncommon", tier: 2, top: 3, right: 5, bottom: 4, left: 3 },
  { name: "Dryad", rarity: "Uncommon", tier: 2, top: 6, right: 2, bottom: 3, left: 4 },
  { name: "Ghoul", rarity: "Uncommon", tier: 2, top: 4, right: 3, bottom: 5, left: 3 },
  { name: "Satyr", rarity: "Uncommon", tier: 2, top: 5, right: 5, bottom: 3, left: 3 },
  { name: "Harpy", rarity: "Uncommon", tier: 2, top: 5, right: 6, bottom: 2, left: 3 },
  { name: "Giant Spider", rarity: "Uncommon", tier: 2, top: 3, right: 6, bottom: 5, left: 3 },
  { name: "Gargoyle", rarity: "Uncommon", tier: 2, top: 6, right: 2, bottom: 3, left: 6 },
  { name: "Naga", rarity: "Uncommon", tier: 2, top: 4, right: 6, bottom: 5, left: 3 },
  { name: "Werewolf", rarity: "Uncommon", tier: 2, top: 3, right: 7, bottom: 5, left: 3 },
  { name: "Cockatrice", rarity: "Uncommon", tier: 2, top: 6, right: 5, bottom: 3, left: 4 },
  { name: "Ogre", rarity: "Rare", tier: 3, top: 3, right: 7, bottom: 5, left: 4 },
  { name: "Troll", rarity: "Rare", tier: 3, top: 6, right: 4, bottom: 6, left: 4 },
  { name: "Mermaid", rarity: "Rare", tier: 3, top: 6, right: 5, bottom: 5, left: 4 },
  { name: "Centaur", rarity: "Rare", tier: 3, top: 5, right: 7, bottom: 4, left: 4 },
  { name: "Wraith", rarity: "Rare", tier: 3, top: 7, right: 3, bottom: 6, left: 4 },
  { name: "Minotaur", rarity: "Rare", tier: 3, top: 4, right: 8, bottom: 5, left: 4 },
  { name: "Yeti", rarity: "Rare", tier: 3, top: 7, right: 4, bottom: 6, left: 4 },
  { name: "Golem", rarity: "Rare", tier: 3, top: 8, right: 3, bottom: 3, left: 8 },
  { name: "Manticore", rarity: "Rare", tier: 3, top: 5, right: 8, bottom: 5, left: 4 },
  { name: "Basilisk", rarity: "Rare", tier: 3, top: 3, right: 8, bottom: 3, left: 8 },
  { name: "Pegasus", rarity: "Epic", tier: 4, top: 8, right: 5, bottom: 5, left: 4 },
  { name: "Griffin", rarity: "Epic", tier: 4, top: 6, right: 7, bottom: 6, left: 5 },
  { name: "Cerberus", rarity: "Epic", tier: 4, top: 5, right: 8, bottom: 6, left: 5 },
  { name: "Roc", rarity: "Epic", tier: 4, top: 8, right: 7, bottom: 4, left: 5 },
  { name: "Wyvern", rarity: "Epic", tier: 4, top: 7, right: 8, bottom: 5, left: 5 },
  { name: "Sphinx", rarity: "Epic", tier: 4, top: 9, right: 4, bottom: 4, left: 8 },
  { name: "Dullahan", rarity: "Epic", tier: 4, top: 6, right: 8, bottom: 7, left: 4 },
  { name: "Chimera", rarity: "Epic", tier: 4, top: 6, right: 8, bottom: 6, left: 6 },
  { name: "Hydra", rarity: "Epic", tier: 4, top: 5, right: 8, bottom: 7, left: 6 },
  { name: "Thunderbird", rarity: "Epic", tier: 4, top: 9, right: 7, bottom: 5, left: 5 },
  { name: "Unicorn", rarity: "Legendary", tier: 5, top: 9, right: 6, bottom: 6, left: 5 },
  { name: "Cyclops", rarity: "Legendary", tier: 5, top: 5, right: 9, bottom: 7, left: 5 },
  { name: "Gorgon", rarity: "Legendary", tier: 5, top: 8, right: 8, bottom: 5, left: 6 },
  { name: "Sea Serpent", rarity: "Legendary", tier: 5, top: 7, right: 9, bottom: 7, left: 5 },
  { name: "Qilin", rarity: "Legendary", tier: 5, top: 9, right: 6, bottom: 7, left: 6 },
  { name: "Phoenix", rarity: "Legendary", tier: 5, top: 9, right: 8, bottom: 5, left: 7 },
  { name: "Frost Dragon", rarity: "Legendary", tier: 5, top: 8, right: 9, bottom: 7, left: 5 },
  { name: "Dragon", rarity: "Legendary", tier: 5, top: 8, right: 9, bottom: 6, left: 7 },
  { name: "Behemoth", rarity: "Legendary", tier: 5, top: 6, right: 10, bottom: 8, left: 6 },
  { name: "Leviathan", rarity: "Legendary", tier: 5, top: 7, right: 9, bottom: 8, left: 6 },
  { name: "Simurgh", rarity: "Mythic", tier: 6, top: 10, right: 7, bottom: 7, left: 6 },
  { name: "Fafnir", rarity: "Mythic", tier: 6, top: 8, right: 10, bottom: 6, left: 7 },
  { name: "Anzu", rarity: "Mythic", tier: 6, top: 10, right: 8, bottom: 6, left: 7 },
  { name: "Kraken", rarity: "Mythic", tier: 6, top: 6, right: 9, bottom: 9, left: 7 },
  { name: "Fenrir", rarity: "Mythic", tier: 6, top: 8, right: 10, bottom: 8, left: 6 },
  { name: "Ancient Dragon", rarity: "Mythic", tier: 6, top: 9, right: 8, bottom: 5, left: 10 },
  { name: "Ziz", rarity: "Mythic", tier: 6, top: 10, right: 9, bottom: 7, left: 7 },
  { name: "Typhon", rarity: "Mythic", tier: 6, top: 8, right: 9, bottom: 9, left: 7 },
  { name: "Nidhoggr", rarity: "Mythic", tier: 6, top: 9, right: 10, bottom: 8, left: 7 },
  { name: "Jormungandr", rarity: "Mythic", tier: 6, top: 8, right: 9, bottom: 9, left: 8 },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const CARD_POOL: Card[] = CREATURES.map((c) => {
  const id = slugify(c.name);
  return {
    id,
    name: c.name,
    rarity: c.rarity,
    tier: c.tier,
    ranks: { top: c.top, bottom: c.bottom, left: c.left, right: c.right },
    image: imageFor(id),
  };
});

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const clone = (c: Card): Card => ({ ...c, ranks: { ...c.ranks } });

/** Deals two disjoint 5-card hands from the pool, cloning each card so board/hand instances are independent. */
export function dealHands(): { handA: Card[]; handB: Card[] } {
  const shuffled = shuffle(CARD_POOL);
  return {
    handA: shuffled.slice(0, 5).map(clone),
    handB: shuffled.slice(5, 10).map(clone),
  };
}

/** Fresh independent clones of the given cards (for a player-chosen hand). */
export function cloneHand(cards: Card[]): Card[] {
  return cards.map(clone);
}

/** Deals a 5-card hand from the pool excluding the given card ids. */
export function dealHandExcluding(excludeIds: Set<string>): Card[] {
  return shuffle(CARD_POOL.filter((c) => !excludeIds.has(c.id)))
    .slice(0, 5)
    .map(clone);
}

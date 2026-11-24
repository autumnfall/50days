import {
  BowArrow, BrickWall, Castle, Coins, Feather, Flame, House, Pickaxe, Shield, Swords, TreePine, Wheat,
  type LucideIcon,
} from 'lucide-react'
import type { BuildingId, NationId, ResourceId, UnitId } from '@/game/config'

export const RESOURCE_ICONS = {
  food: Wheat,
  wood: TreePine,
  gold: Coins,
} satisfies Record<ResourceId, LucideIcon>

export const BUILDING_ICONS = {
  farm: Wheat,
  lumber: TreePine,
  mine: Pickaxe,
  house: House,
  barracks: Shield,
  wall: BrickWall,
  tower: Castle,
} satisfies Record<BuildingId, LucideIcon>

export const NATION_ICONS = {
  agriculture: Wheat,
  military: Swords,
  commerce: Coins,
} satisfies Record<NationId, LucideIcon>

export const UNIT_ICONS = {
  militia: Swords,
  archer: BowArrow,
  knight: Shield,
  warlord: Flame,
} satisfies Record<UnitId, LucideIcon>

const HERO_ICONS: Record<string, LucideIcon> = {
  limu: Shield,
  huoqubing: Swords,
  zhugeliang: Feather,
  leonidas: Shield,
}

export function heroIcon(id: string): LucideIcon {
  return HERO_ICONS[id] ?? Shield
}

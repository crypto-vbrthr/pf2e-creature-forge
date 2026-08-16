export const CORE_ATTACK_NAME_KEYS = Object.freeze({
  "Claw": "PF2E_CREATURE_FORGE.AttackName.Claw",
  "Jaws": "PF2E_CREATURE_FORGE.AttackName.Jaws",
  "Talons": "PF2E_CREATURE_FORGE.AttackName.Talons",
  "Bite": "PF2E_CREATURE_FORGE.AttackName.Bite",
  "Horn": "PF2E_CREATURE_FORGE.AttackName.Horn",
  "Slam": "PF2E_CREATURE_FORGE.AttackName.Slam",
  "Tail": "PF2E_CREATURE_FORGE.AttackName.Tail",
  "Tentacle": "PF2E_CREATURE_FORGE.AttackName.Tentacle",
  "Maw": "PF2E_CREATURE_FORGE.AttackName.Maw",
  "Thorn": "PF2E_CREATURE_FORGE.AttackName.Thorn",
  "Tendril": "PF2E_CREATURE_FORGE.AttackName.Tendril",
  "Spore Lash": "PF2E_CREATURE_FORGE.AttackName.SporeLash",
  "Pseudopod": "PF2E_CREATURE_FORGE.AttackName.Pseudopod",
  "Grasp": "PF2E_CREATURE_FORGE.AttackName.Grasp",
  "Fist": "PF2E_CREATURE_FORGE.AttackName.Fist",
  "Elemental Strike": "PF2E_CREATURE_FORGE.AttackName.ElementalStrike",
  "Quick Strike": "PF2E_CREATURE_FORGE.AttackName.QuickStrike",
  "Heavy Strike": "PF2E_CREATURE_FORGE.AttackName.HeavyStrike",
  "Force Touch": "PF2E_CREATURE_FORGE.AttackName.ForceTouch",
  "Ethereal Touch": "PF2E_CREATURE_FORGE.AttackName.EtherealTouch",
  "Heavy Shot": "PF2E_CREATURE_FORGE.AttackName.HeavyShot",
  "Precise Shot": "PF2E_CREATURE_FORGE.AttackName.PreciseShot",
  "Projectile": "PF2E_CREATURE_FORGE.AttackName.Projectile",
  "Strike": "PF2E_CREATURE_FORGE.AttackName.Strike"
});

export function resolveAttackNameKey(attackOrName) {
  if (attackOrName && typeof attackOrName === "object" && attackOrName.nameKey) return String(attackOrName.nameKey);
  const name = typeof attackOrName === "object" ? attackOrName?.name : attackOrName;
  return CORE_ATTACK_NAME_KEYS[String(name ?? "")] ?? null;
}

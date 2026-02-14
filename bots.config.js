/**
 * Configuration des bots disponibles
 * Ne peut être modifiée que par le développeur
 */
const BOTS_CONFIG = [
  {
    id: "inconnu_xd_v2",
    name: "INCONNU-XD-V2",
    repo: "https://github.com/INCONNU-BOY/INCONNU-XD-V2",
    start: "npm start",
    env_required: ["SESSION_ID", "OWNER_NUMBER"],
    description: "Bot WhatsApp multi-fonctionnalités"
  },
  {
    id: "popkid_md",
    name: "POPKID-MD",
    repo: "https://github.com/popkidmd/POPKID-MD",
    start: "npm start",
    env_required: ["SESSION_ID"],
    description: "Bot WhatsApp avec fonctionnalités avancées"
  }
];

module.exports = BOTS_CONFIG;

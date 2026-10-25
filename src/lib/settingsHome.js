// Where each app_config setting lives in the Operator: the tab (and view) that owns what it
// controls. Labels, hints and groups come from the API (Quizup backend/services/configSchema.js);
// only the placement is decided here. A group with no home lands in Game rules, so a new
// setting is never lost.

const GROUP_HOME = {
  'Gameplay':           { tab: 'rules' },
  'XP Economy':         { tab: 'rules' },
  'Lifelines':          { tab: 'rules' },
  'Coins':              { tab: 'economy', view: 'store' },
  'KWIZ+':              { tab: 'economy', view: 'store' },
  'Store':              { tab: 'economy', view: 'store' },
  'KWIZ Live':          { tab: 'live' },
  'Missions':           { tab: 'world', view: 'missions' },
  'Clans & crowns':     { tab: 'world', view: 'clans' },
  'Social & discovery': { tab: 'world', view: 'discover' },
  'Content':            { tab: 'rules' },
  'Safety':             { tab: 'moderation' },
  'Comms':              { tab: 'comms' },
  'System':             { tab: 'system' },
  'AI models':          { tab: 'ai-logs' },
};

// Single keys that belong somewhere other than their group's home
const KEY_HOME = {
  clan_bots:             { tab: 'bots' },
  discover_bot_slots:    { tab: 'bots' },
  leaderboard_bot_slots: { tab: 'bots' },
  nearby_bot_slots:      { tab: 'bots' },
  crown_min_players:     { tab: 'world', view: 'crowns' },
  crown_min_xp:          { tab: 'world', view: 'crowns' },
};

/** { tab, view? } for a config entry from GET /admin/config */
export function homeOf(entry) {
  return KEY_HOME[entry.key] ?? GROUP_HOME[entry.meta?.group] ?? { tab: 'rules' };
}

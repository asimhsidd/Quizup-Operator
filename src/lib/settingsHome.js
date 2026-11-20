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
  'Rooms':              { tab: 'rooms' },
  'Missions':           { tab: 'world', view: 'missions' },
  'Clans & crowns':     { tab: 'world', view: 'clans' },
  'Social & discovery': { tab: 'world', view: 'discover' },
  'Content':            { tab: 'library' },
  'Safety':             { tab: 'safety' },
  'Comms':              { tab: 'comms' },
  'System':             { tab: 'system' },
  'AI models':          { tab: 'ai-logs' },
  'Agent':              { tab: 'agent' },
};

// Single keys that belong somewhere other than their group's home
const KEY_HOME = {
  clan_bots:             { tab: 'bots' },
  discover_bot_slots:    { tab: 'bots' },
  leaderboard_bot_slots: { tab: 'bots' },
  nearby_bot_slots:      { tab: 'bots' },
  crown_min_players:     { tab: 'world', view: 'crowns' },
  crown_min_xp:          { tab: 'world', view: 'crowns' },
  // The agent's model sits with the other models, but its price and model are the agent's business too
  ai_agent_model:        { tab: 'agent' },
  ai_agent_provider:     { tab: 'agent' },
  ai_agent_input_usd_per_m:  { tab: 'agent' },
  ai_agent_output_usd_per_m: { tab: 'agent' },
};

/** { tab, view? } for a config entry from GET /admin/config */
export function homeOf(entry) {
  return KEY_HOME[entry.key] ?? GROUP_HOME[entry.meta?.group] ?? { tab: 'rules' };
}

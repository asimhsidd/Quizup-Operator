// Game rules: the settings that belong to no other tab, i.e. how a match plays and pays
// (Gameplay, XP and ranks, Lifelines). Where every setting lives is lib/settingsHome.js.
import SettingsSection from '../components/SettingsSection.jsx';

export default function GameRulesTab({ token }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[#1A1A2E] font-bold text-lg">Game rules</h2>
        <p className="text-gray-500 text-xs mt-0.5">Rounds, scoring, XP, ranks and lifelines. Changes take effect within 30 seconds; new games use them.</p>
      </div>
      <SettingsSection token={token} tab="rules" title="Rules" defaultOpen />
    </div>
  );
}

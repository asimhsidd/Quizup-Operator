// Safety: everything that protects players and the game's content. Reports (player
// reports as cases), the moderation queues (pictures, player-made topics, reported
// questions) and Question quality (flagged questions). The Safety settings sit below.
import { useState } from 'react';
import { Pills } from '../components/Panels.jsx';
import SettingsSection from '../components/SettingsSection.jsx';
import PlayerReports from '../components/safety/PlayerReports.jsx';
import { Pictures, PlayerTopics, QuestionReports } from '../components/safety/ModerationQueues.jsx';
import QuestionQuality from '../components/safety/QuestionQuality.jsx';
import { useFocusView } from '../store/navStore';

const VIEWS = [
  ['reports', 'Reports', PlayerReports],
  ['pictures', 'Pictures', Pictures],
  ['player-topics', 'Player topics', PlayerTopics],
  ['question-reports', 'Reported questions', QuestionReports],
  ['quality', 'Question quality', QuestionQuality],
];

export default function SafetyTab({ token }) {
  const [view, setView] = useState('reports');
  useFocusView('safety', setView);
  const Active = VIEWS.find(v => v[0] === view)[2];
  return (
    <div className="flex flex-col gap-5">
      <Pills options={VIEWS.map(([id, label]) => [id, label])} value={view} onChange={setView} />
      <Active key={view} token={token} />
      <SettingsSection token={token} tab="safety" />
    </div>
  );
}

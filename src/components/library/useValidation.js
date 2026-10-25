// Gemini fact-checking for a subcategory or a topic (POST /admin/{categories|topics}/:id/validate),
// with progress from the validation_* socket events. Questions it doubts go to
// Safety → Question quality.
import { useEffect, useState } from 'react';
import { adminFetch } from '../../lib/adminUtils.jsx';
import { socket } from '../../lib/socket';
import { useToastStore } from '../../lib/toastStore';

export function useValidation(token, kind, id, onDone) {
  const [run, setRun] = useState(null); // { checked, total, flagged } while running
  const [last, setLast] = useState(null); // { checked, flagged } when it finished
  const { addToast } = useToastStore();

  useEffect(() => {
    setRun(null); setLast(null);
    function onProgress(e) { if (e.scope === id) setRun({ checked: e.checked, total: e.total, flagged: e.flagged }); }
    function onComplete(e) {
      if (e.scope !== id) return;
      setRun(null); setLast({ checked: e.checked, flagged: e.flagged });
      onDone?.();
    }
    function onError(e) { if (e.scope === id) { setRun(null); addToast(`Validation failed: ${e.message}`, 'error'); } }
    socket.on('validation_progress', onProgress);
    socket.on('validation_complete', onComplete);
    socket.on('validation_error', onError);
    return () => {
      socket.off('validation_progress', onProgress);
      socket.off('validation_complete', onComplete);
      socket.off('validation_error', onError);
    };
  }, [id]);

  async function start() {
    try {
      await adminFetch(`/admin/${kind === 'topic' ? 'topics' : 'categories'}/${id}/validate`, { method: 'POST' }, token);
      setRun({ checked: 0, total: null, flagged: 0 });
    } catch (err) { addToast(err.message, 'error'); }
  }

  const label = run
    ? `Checking ${run.total != null ? `${run.checked}/${run.total}` : '…'}`
    : last ? `Checked ${last.checked}, ${last.flagged} flagged` : null;
  return { running: !!run, label, start };
}

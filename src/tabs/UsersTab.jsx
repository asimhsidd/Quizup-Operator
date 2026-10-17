import { Fragment, useEffect, useRef, useState } from 'react';
import { useToastStore } from '../lib/toastStore';
import { fmtXp } from '../lib/fmt';
import { adminFetch, adminUpload, Btn, Spinner, SortableTableHeader, makeSortHandler, multiSort, Paginator } from '../lib/adminUtils.jsx';
import WalletPanel from '../components/WalletPanel.jsx';

const USER_COLS = [
  { label: 'User',    key: 'username'   },
  { label: 'Email',   key: null         },
  { label: 'XP',      key: 'total_xp'   },
  { label: 'Coins',   key: 'coins'      },
  { label: 'Joined',  key: 'created_at' },
  { label: 'Actions', key: null         },
];

export default function UsersTab({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hideBots, setHideBots] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [userSortKeys, setUserSortKeys] = useState([]);
  const handleUserSort = makeSortHandler(setUserSortKeys);
  const fileInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [resetPwdId, setResetPwdId] = useState(null);
  const [resetPwdVal, setResetPwdVal] = useState('');
  const [editXpId, setEditXpId] = useState(null);
  const [editXpVal, setEditXpVal] = useState('');
  const [walletId, setWalletId] = useState(null); // the user whose Wallet panel is open
  const { addToast } = useToastStore();
  const LIMIT = 50;

  async function load(p = page) {
    setLoading(true);
    try {
      const data = await adminFetch(`/admin/users?limit=${LIMIT}&offset=${p * LIMIT}`, {}, token);
      if (Array.isArray(data)) {
        setUsers(data);
        setTotal(data.length < LIMIT && p === 0 ? data.length : (p + 1) * LIMIT + (data.length === LIMIT ? 1 : 0));
      } else {
        setUsers(data.users ?? data);
        setTotal(data.total ?? (data.users ?? data).length);
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(0); }, []);

  useEffect(() => {
    load(page);
  }, [page]);

  async function deleteUser(id, username) {
    try {
      await adminFetch(`/admin/users/${id}`, { method: 'DELETE' }, token);
      addToast(`Deleted ${username}`, 'success');
      load(page);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function resetXp(id, username) {
    try {
      await adminFetch(`/admin/users/${id}/reset-xp`, { method: 'PUT' }, token);
      addToast(`XP reset for ${username}`, 'success');
      load(page);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function saveXp(id, username) {
    const xp = parseInt(editXpVal, 10);
    if (isNaN(xp) || xp < 0) return;
    try {
      await adminFetch(`/admin/users/${id}/xp`, { method: 'PUT', body: { xp } }, token);
      addToast(`XP updated for ${username}`, 'success');
      setEditXpId(null);
      setEditXpVal('');
      load(page);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function resetPassword(id, username) {
    if (resetPwdVal.length < 6) return;
    try {
      await adminFetch(`/admin/users/${id}/reset-password`, { method: 'PUT', body: { password: resetPwdVal } }, token);
      addToast(`Password reset for ${username}`, 'success');
      setResetPwdId(null);
      setResetPwdVal('');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function changeAvatar(file) {
    if (!file || !uploadingId) return;
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const data = await adminUpload(`/admin/users/${uploadingId}/avatar`, fd, token);
      setUsers(us => us.map(u => u.id === uploadingId ? { ...u, avatar_url: data.avatar_url } : u));
      addToast('Avatar updated', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setUploadingId(null);
    }
  }

  if (loading) return <Spinner />;

  const botCount = users.filter(u => u.is_bot).length;
  const afterBotFilter = hideBots ? users.filter(u => !u.is_bot) : users;
  const afterSearch = search.trim()
    ? afterBotFilter.filter(u =>
        u.username?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      )
    : afterBotFilter;
  const visibleUsers = multiSort(afterSearch, userSortKeys);

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { changeAvatar(e.target.files[0]); e.target.value = ''; }}
      />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#1A1A2E] font-bold text-lg">Users ({visibleUsers.length}{botCount > 0 && hideBots ? ` · ${botCount} bots hidden` : ''})</h2>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by name / email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-50 border border-[#E0E0E0] text-[#1A1A2E] rounded-lg px-3 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:border-[#E8453C] w-48"
          />
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-gray-600">
            <input
              type="checkbox"
              checked={hideBots}
              onChange={e => setHideBots(e.target.checked)}
              className="w-4 h-4 accent-[#1A1A2E] cursor-pointer"
            />
            Hide bots
          </label>
          <Btn onClick={() => load(page)} variant="ghost">Refresh</Btn>
        </div>
      </div>
      <div className="overflow-x-auto bg-white border border-[#E0E0E0] rounded-xl shadow-sm">
        <table className="w-full text-sm">
          <SortableTableHeader columns={USER_COLS} sortKeys={userSortKeys} onSort={handleUserSort} />
          <tbody>
            {visibleUsers.map(u => (
              <Fragment key={u.id}>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                          {u.username[0].toUpperCase()}
                        </div>
                    }
                    <span className="text-[#1A1A2E] font-semibold">{u.username}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  {editXpId === u.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={editXpVal}
                        onChange={e => setEditXpVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveXp(u.id, u.username); if (e.key === 'Escape') { setEditXpId(null); setEditXpVal(''); } }}
                        className="w-20 border border-cyan-400 rounded px-1.5 py-0.5 text-sm font-bold text-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        autoFocus
                      />
                      <button onClick={() => saveXp(u.id, u.username)} className="text-xs text-green-600 font-bold hover:underline">Save</button>
                      <button onClick={() => { setEditXpId(null); setEditXpVal(''); }} className="text-xs text-gray-400 hover:underline">✕</button>
                    </div>
                  ) : (
                    <span
                      className="text-cyan-600 font-bold cursor-pointer hover:underline"
                      title="Click to edit XP"
                      onClick={() => { setEditXpId(u.id); setEditXpVal(String(u.total_xp ?? 0)); }}
                    >
                      {fmtXp(u.total_xp)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-bold text-amber-600">{(u.coins ?? 0).toLocaleString()}</span>
                  {u.plus && <span className="ml-1.5 text-[10px] font-bold text-pink-700 bg-pink-100 rounded px-1 py-0.5">KWIZ+</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 flex-wrap">
                    <Btn onClick={() => setWalletId(id => (id === u.id ? null : u.id))} variant="primary">Wallet</Btn>
                    <Btn onClick={() => resetXp(u.id, u.username)} variant="ghost">Reset XP</Btn>
                    <Btn
                      onClick={() => {
                        setResetPwdId(id => id === u.id ? null : u.id);
                        setResetPwdVal('');
                      }}
                      variant="ghost"
                    >
                      Reset Pwd
                    </Btn>
                    <Btn
                      onClick={() => { setUploadingId(u.id); fileInputRef.current.click(); }}
                      variant="primary"
                    >
                      Photo
                    </Btn>
                    <Btn onClick={() => deleteUser(u.id, u.username)} variant="danger">Delete</Btn>
                  </div>
                </td>
              </tr>
              {resetPwdId === u.id && (
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-500 text-xs shrink-0">New password for <span className="text-[#1A1A2E] font-semibold">{u.username}</span>:</span>
                      <input
                        type="password"
                        placeholder="Min 6 characters"
                        value={resetPwdVal}
                        onChange={e => setResetPwdVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && resetPassword(u.id, u.username)}
                        className="bg-white border border-[#E0E0E0] text-[#1A1A2E] rounded px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:border-[#E8453C]"
                        autoFocus
                      />
                      <Btn
                        onClick={() => resetPassword(u.id, u.username)}
                        variant="success"
                        disabled={resetPwdVal.length < 6}
                      >
                        Save
                      </Btn>
                      <Btn onClick={() => { setResetPwdId(null); setResetPwdVal(''); }} variant="ghost">Cancel</Btn>
                    </div>
                  </td>
                </tr>
              )}
              {walletId === u.id && (
                <tr className="border-b border-gray-100 bg-amber-50/40">
                  <td colSpan={6} className="px-4 py-4">
                    <WalletPanel userId={u.id} token={token} onChanged={() => load(page)} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {visibleUsers.length === 0 && (
          <p className="text-center text-gray-400 py-8">No users found.</p>
        )}
        <Paginator page={page} total={total} limit={LIMIT} onPage={p => setPage(p)} />
      </div>
    </div>
  );
}

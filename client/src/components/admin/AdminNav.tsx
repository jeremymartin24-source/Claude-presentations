import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAdminContext } from '../../context/AdminContext'

const navLinks = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/courses', label: 'Courses', icon: '📚' },
  { to: '/admin/banks', label: 'Question Banks', icon: '🗂️' },
  { to: '/admin/import', label: 'Import', icon: '📥' },
  { to: '/admin/launch', label: 'Launch Game', icon: '🚀' },
  { to: '/admin/history', label: 'History', icon: '📋' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
]

export function AdminNav() {
  const { logout } = useAdminContext()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-gray-950 border-b border-unoh-red/40 sticky top-0 z-40">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo + Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 bg-unoh-red rounded-lg flex items-center justify-center text-xl font-display font-black text-white select-none">
              U
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-display font-black text-white leading-none tracking-wide">
                UNOH REVIEW GAMES
              </div>
              <div className="text-xs text-gray-400 leading-none mt-0.5">Prof. Martin — Admin</div>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide flex-1 justify-center">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                  isActive
                    ? 'bg-unoh-red text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                <span>{link.icon}</span>
                <span className="hidden md:inline">{link.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Prof badge + logout */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden lg:flex items-center gap-2 bg-unoh-red/10 border border-unoh-red/30 rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-300">Prof. Martin</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

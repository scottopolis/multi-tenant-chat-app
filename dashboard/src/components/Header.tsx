import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Home, LayoutDashboard, Menu, X } from 'lucide-react'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-200">
        <div className="flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} className="text-gray-700" />
          </button>
          <h1 className="ml-4 text-lg font-semibold tracking-tight">
            <Link to="/" className="text-gray-900 hover:text-gray-600">
              Chat Assistant
            </Link>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9',
                },
              }}
            />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors mb-1"
            activeProps={{
              className:
                'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors mb-1',
            }}
          >
            <Home size={18} />
            <span className="text-sm font-medium">Home</span>
          </Link>
          <SignedIn>
            <Link
              to="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors mb-1"
              activeProps={{
                className:
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors mb-1',
              }}
            >
              <LayoutDashboard size={18} />
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
          </SignedIn>
        </nav>
      </aside>
    </>
  )
}

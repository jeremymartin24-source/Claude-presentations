import { SocketProvider } from './context/SocketContext'
import { GameProvider } from './context/GameContext'
import { AdminProvider } from './context/AdminContext'
import AppRouter from './router'

export default function App() {
  return (
    <SocketProvider>
      <AdminProvider>
        <GameProvider>
          <AppRouter />
        </GameProvider>
      </AdminProvider>
    </SocketProvider>
  )
}

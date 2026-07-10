import { Navigate, Route, Routes } from 'react-router-dom'

import { HomePage } from './pages/HomePage'
import { HostLivePage } from './pages/HostLivePage'
import { HostPage } from './pages/HostPage'
import { PlayerJoinPage } from './pages/PlayerJoinPage'
import { PlayerSessionPage } from './pages/PlayerSessionPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/host" element={<HostPage />} />
      <Route path="/host/live/:joinCode" element={<HostLivePage />} />
      <Route path="/play" element={<PlayerJoinPage />} />
      <Route path="/play/session/:joinCode" element={<PlayerSessionPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

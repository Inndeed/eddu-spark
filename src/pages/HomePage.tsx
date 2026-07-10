import { Link } from 'react-router-dom'

const modeCards = [
  {
    title: 'Knowledge Check',
    description: 'เช็กความเข้าใจระหว่าง training หรือ workshop แบบทันที',
  },
  {
    title: 'Scenario Sprint',
    description: 'ให้ทีมตัดสินใจจากโจทย์ธุรกิจจริงและ debrief ต่อได้เลย',
  },
  {
    title: 'Team Pulse',
    description: 'สร้างพลังห้องและใช้ leaderboard แบบไม่ทำให้คนถอย',
  },
]

export function HomePage() {
  return (
    <main className="app-shell app-shell-ci">
      <section className="hero-panel hero-panel-ci">
        <div className="hero-copy hero-copy-ci">
          <span className="eyebrow">EDDU Internal Live Game</span>
          <h1>EDDU Spark</h1>
          <p className="hero-text hero-text-wide">
            เปลี่ยน workshop ให้กลายเป็น live participation layer ที่ทั้งเช็กความเข้าใจ,
            สร้าง momentum, และชวน debrief ต่อได้ในห้องจริง
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/host">
              เปิด Host Studio
            </Link>
            <Link className="button button-secondary" to="/play">
              เข้าร่วมเกม
            </Link>
          </div>
          <div className="hero-badges">
            <span className="hero-pill">Host login + public join</span>
            <span className="hero-pill">Real-time scoring</span>
            <span className="hero-pill">Thai-first workshop UX</span>
          </div>
        </div>

        <div className="hero-side hero-side-ci">
          <div className="poster-frame">
            <div className="poster-art">
              <div className="poster-grid" />
              <div className="poster-chip">LIVE WORKSHOP GAME</div>
              <div className="poster-main">
                <span className="poster-kicker">EDDU SPARK</span>
                <strong>LEARN</strong>
                <strong>ANSWER</strong>
                <strong>DEBRIEF</strong>
              </div>
              <div className="poster-footer">
                <span>THAI-FIRST</span>
                <span>TEAM ENERGY</span>
                <span>HOST CONTROL</span>
              </div>
            </div>
          </div>
          <div className="score-orb score-orb-ci">
            <div className="score-orb-label">Spark Loop</div>
            <div className="score-orb-value">ถาม → ตอบ → เฉลย</div>
            <p>Question → Answer → Reveal → Debrief</p>
          </div>
        </div>
      </section>

      <section className="section-grid section-grid-ci">
        {modeCards.map((card) => (
          <article className="feature-card feature-card-ci" key={card.title}>
            <span className="feature-kicker">Mode</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </section>

      <section className="content-panel content-panel-ci home-flow-panel">
        <div className="panel-header">
          <span className="eyebrow">Production Flow</span>
          <h2>Live game สำหรับ session ภายในที่พร้อมขึ้น internet</h2>
        </div>
        <div className="timeline-grid timeline-grid-ci">
          <div className="timeline-card timeline-card-ci">
            <strong>1. Host sign in</strong>
            <p>ใช้บัญชี host ที่ถูก invite ผ่าน Supabase Auth</p>
          </div>
          <div className="timeline-card timeline-card-ci">
            <strong>2. Launch session</strong>
            <p>เปิดเกมและ generate join code สำหรับ participant ทันที</p>
          </div>
          <div className="timeline-card timeline-card-ci">
            <strong>3. Play on any browser</strong>
            <p>ผู้เล่นตอบผ่านมือถือ ส่วน host คุม flow บนจอหลัก</p>
          </div>
          <div className="timeline-card timeline-card-ci">
            <strong>4. Score + debrief</strong>
            <p>ดู distribution, leaderboard, hardest question และ topic signal หลัง session</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export function LoadingScreen() {
  return (
    <div className="boot-shell">
      <div className="boot-grid" aria-hidden />
      <div className="boot-glow" aria-hidden />

      <div className="boot-stage">
        <div className="boot-mark" aria-hidden>
          <span className="boot-mark-ring" />
          <img src="/clawtrl.jpg" alt="" />
        </div>

        <div className="boot-meta">
          <span className="boot-kicker">PortalFND // Clawtrl Ops</span>
          <span className="boot-title">Initialising Command Bridge</span>
          <span className="boot-sub">Linking workspaces and verifying telemetry</span>
        </div>

        <ul className="boot-checklist" aria-label="Boot sequence">
          <li style={{ animationDelay: '0.05s' }}>
            <span className="boot-id">01</span>
            <span className="boot-label">Fleet Bay</span>
            <span className="boot-status">roster online</span>
          </li>
          <li style={{ animationDelay: '0.45s' }}>
            <span className="boot-id">02</span>
            <span className="boot-label">Treasury Vault</span>
            <span className="boot-status">base rail ready</span>
          </li>
          <li style={{ animationDelay: '0.85s' }}>
            <span className="boot-id">03</span>
            <span className="boot-label">Signal Stack</span>
            <span className="boot-status">streams locked</span>
          </li>
        </ul>

        <div className="boot-bar" role="progressbar" aria-label="Loading">
          <span className="boot-bar-fill" />
        </div>
      </div>
    </div>
  )
}

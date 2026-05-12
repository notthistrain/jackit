export default function MainApp() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ padding: '8px 16px', background: '#323233', color: '#007acc', fontWeight: 700 }}>
        JackCom — Serial Debugger
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#858585' }}>
        Main Window Skeleton
      </div>
    </div>
  )
}

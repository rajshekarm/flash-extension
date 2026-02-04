

















































































































































































































































































































































































































/**
 * Flash Welcome Page
 * Displayed on first installation to introduce users to the extension
 */
import "~style.css"

const containerStyle: React.CSSProperties = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px"
}

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "16px",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
  maxWidth: "800px",
  width: "100%",
  padding: "48px",
  textAlign: "center"
}

const featuresStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "24px",
  marginBottom: "40px",
  textAlign: "left"
}

const featureStyle: React.CSSProperties = {
  padding: "20px",
  background: "#f7fafc",
  borderRadius: "8px"
}

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "white",
  padding: "14px 32px",
  borderRadius: "8px",
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: 600,
  border: "none",
  cursor: "pointer"
}

function Welcome() {
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚡</div>
        <h1 style={{ fontSize: 32, color: "#1a1a1a", marginBottom: 16 }}>
          Welcome to Flash Assistant!
        </h1>
        <p style={{ fontSize: 18, color: "#666", marginBottom: 40 }}>
          Your AI-powered job application helper
        </p>

        <div style={featuresStyle}>
          <div style={featureStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
            <h3 style={{ fontSize: 16, color: "#1a1a1a", marginBottom: 8 }}>Smart Job Analysis</h3>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.5 }}>
              Analyzes job postings and matches them with your profile automatically.
            </p>
          </div>

          <div style={featureStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
            <h3 style={{ fontSize: 16, color: "#1a1a1a", marginBottom: 8 }}>Resume Tailoring</h3>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.5 }}>
              Tailors your resume and cover letter to each specific position.
            </p>
          </div>

          <div style={featureStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
            <h3 style={{ fontSize: 16, color: "#1a1a1a", marginBottom: 8 }}>Intelligent Auto-Fill</h3>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.5 }}>
              Fills application forms with contextually relevant information.
            </p>
          </div>

          <div style={featureStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <h3 style={{ fontSize: 16, color: "#1a1a1a", marginBottom: 8 }}>AI Answer Generation</h3>
            <p style={{ fontSize: 14, color: "#666", lineHeight: 1.5 }}>
              Generates thoughtful answers to application questions.
            </p>
          </div>
        </div>

        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            chrome.runtime.openOptionsPage()
            window.close()
          }}
        >
          Get Started
        </button>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #e2e8f0", fontSize: 14, color: "#666" }}>
          <p>Visit a job posting on LinkedIn, Indeed, Workday, or other supported platforms to begin.</p>
        </div>
      </div>
    </div>
  )
}

export default Welcome

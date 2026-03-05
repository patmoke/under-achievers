export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      marginTop: 'auto',
      padding: '20px 24px',
      textAlign: 'center'
    }}>
      <p style={{
        color: 'var(--slate)', fontSize: 11, lineHeight: 1.7,
        maxWidth: 800, margin: '0 auto'
      }}>
        Under Achievers is an unofficial fan game not affiliated with or endorsed by the NFL, its teams, or any related entities.
        Team names and logos are the property of their respective owners.
        This site is for entertainment purposes only. No real money is wagered or can be won.
        Point spread data is sourced from public oddsmakers for entertainment use only.
      </p>
    </footer>
  );
}

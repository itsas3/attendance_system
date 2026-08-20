export default function DashboardLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="skeleton-pulse" style={{ width: "220px", height: "32px" }} />
          <div className="skeleton-pulse" style={{ width: "340px", height: "18px" }} />
        </div>
        <div
          className="skeleton-pulse"
          style={{ width: "140px", height: "40px", borderRadius: "10px" }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px"
        }}
      >
        <div className="skeleton-pulse" style={{ height: "100px" }} />
        <div className="skeleton-pulse" style={{ height: "100px" }} />
        <div className="skeleton-pulse" style={{ height: "100px" }} />
      </div>

      <div className="skeleton-pulse" style={{ width: "100%", height: "320px" }} />
    </div>
  );
}

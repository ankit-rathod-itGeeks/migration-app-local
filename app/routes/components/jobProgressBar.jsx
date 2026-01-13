import React from "react";

export default function JobProgressBar({ job }) {
  if (!job) return null;

  const getProgress = () => {
    switch (job.status) {
      case "queued":
        return 0.2;
      case "running":
        return 0.6;
      case "completed":
        return 1;
      case "failed":
        return 1;
      default:
        return 0;
    }
  };

  const progress = getProgress() * 100;

  const barColor =
    job.status === "failed"
      ? "#d82c0d"
      : job.status === "completed"
      ? "#008060"
      : "#1c6ed5";

  return (
    <div style={{ marginTop: "12px" }}>
      <div
        style={{
          height: "8px",
          width: "100%",
          background: "#e1e3e5",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: barColor,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      <div style={{ marginTop: "4px", fontSize: "12px", color: "#6d7175" }}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}

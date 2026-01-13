import React from "react";

export default function JobsListTable(props) {
  const {
    jobsList,
    jobsLoading,
    jobsError,
    isUploading,
    onRefreshList,
    onRefreshJob,
    onViewJob,
    renderProgress,
  } = props;

  return (
    <s-card>
      <s-stack gap="300">
        <s-stack gap="200" direction="horizontal">
          <s-button
            variant="secondary"
            disabled={jobsLoading || isUploading}
            onClick={onRefreshList}
          >
            {jobsLoading ? "Refreshing..." : "Refresh jobs list"}
          </s-button>
        </s-stack>

        {jobsError ? (
          <s-banner status="critical">
            <div>{jobsError}</div>
          </s-banner>
        ) : null}

        {jobsLoading ? (
          <s-text>Loading jobs…</s-text>
        ) : jobsList && jobsList.length ? (
          <s-section padding="none">
            <s-table>
              <s-table-header-row>
                <s-table-header>Job ID</s-table-header>
                <s-table-header>File</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Progress</s-table-header> {/* ✅ */}
                <s-table-header format="numeric">Processed</s-table-header>
                <s-table-header format="numeric">Success</s-table-header>
                <s-table-header format="numeric">Failed</s-table-header>
                <s-table-header>Message</s-table-header>
                <s-table-header>Download</s-table-header> {/* ✅ NEW */}
              </s-table-header-row>

              <s-table-body>
                {jobsList.map((j) => {
                  const id = String(j._id || j.jobId || "");
                  const statusVal = j.status || "";
                  const fileName = j.originalFileName || "";
                  const msg = j.message || "";
                  const progress = j.progress || {};

                  const processed = Number(progress.processed || 0);
                  const total = Number(progress.total || 0);
                  const success = Number(progress.success || 0);
                  const failed = Number(progress.failed || 0);

                  return (
                    <s-table-row key={id}>
                      <s-table-cell>{id}</s-table-cell>
                      <s-table-cell>{fileName}</s-table-cell>
                      <s-table-cell>{statusVal}</s-table-cell>
                      <s-table-cell>
                        {renderProgress ? renderProgress(j) : "—"}
                      </s-table-cell>
                      <s-table-cell>{`${processed}/${total}`}</s-table-cell>
                      <s-table-cell>{success}</s-table-cell>
                      <s-table-cell>{failed}</s-table-cell>
                      <s-table-cell>{msg}</s-table-cell>

                      <s-table-cell>
                        {j.reportPath ? (
                          <s-button
                            size="slim"
                            variant="secondary"
                            onClick={() => props.onDownloadReport?.(j)}
                          >
                            Download
                          </s-button>
                        ) : (
                          "—"
                        )}
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          </s-section>
        ) : (
          <s-text>No jobs found.</s-text>
        )}
      </s-stack>
    </s-card>
  );
}

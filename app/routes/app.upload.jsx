import React, { useEffect, useRef, useState } from "react";
import JobsListTable from "./components/JobsListTable"; // ✅ adjust path if needed

export default function Upload() {
  const [resourceKey, setResourceKey] = useState("products");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  // loading state
  const [isUploading, setIsUploading] = useState(false);

  // used to force-remount <s-drop-zone> so it clears its internal state
  const [dropKey, setDropKey] = useState(0);

  // ✅ report UI state (from API response)
  const [reportInfo, setReportInfo] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");

  // ✅ job/polling state (only for products_job)
  const [jobId, setJobId] = useState("");
  const [jobInfo, setJobInfo] = useState(null);
  const pollTimerRef = useRef(null);

  // ✅ job list state (only for products_job)
  const [jobsList, setJobsList] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");

  function extractFirstFile(event) {
    const d = event?.detail;

    const candidates =
      d?.files || d?.acceptedFiles || d?.allFiles || d?.file || d?.selectedFiles;

    if (candidates instanceof File) return candidates;
    if (Array.isArray(candidates) && candidates[0] instanceof File)
      return candidates[0];

    const elFiles = event?.currentTarget?.files;
    if (elFiles && elFiles[0] instanceof File) return elFiles[0];

    return null;
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  async function pollJob(nextJobId) {
    const id = nextJobId || jobId;
    if (!id) return;

    try {
      const res = await fetch(`/api/upload?jobId=${encodeURIComponent(id)}`, {
        method: "GET",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(json?.message || "Failed to fetch job status");
        stopPolling();
        return;
      }

      // ✅ expect sendResponse shape: { status, message, result: {...job} }
      const j = json?.result || null;
      if (!j) {
        setStatus("Job status response is missing result");
        stopPolling();
        return;
      }

      setJobInfo(j);

      // helpful UI text
      if (j.message) setStatus(j.message);

      // completed → enable download
      if (j.status === "completed") {
        stopPolling();

        if (j.reportFileName) {
          setDownloadUrl(j.reportPath);
        }

        // refresh list
        fetchJobsList();
        return;
      }

      // failed → stop
      if (j.status === "failed") {
        stopPolling();
        setStatus(j.error || "Job failed");
        fetchJobsList();
        return;
      }

      // queued/running → continue polling
      // pollTimerRef.current = setTimeout(() => pollJob(id), 3000);
    } catch (e) {
      console.error(e);
      setStatus("Polling failed due to a network/server error.");
      stopPolling();
    }
  }

  async function fetchJobsList() {
    try {
      setJobsLoading(true);
      setJobsError("");

      const res = await fetch(`/api/upload?resourceKey=products_job`, {
        method: "GET",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setJobsError(json?.message || "Failed to fetch jobs list");
        return;
      }

      const list = json?.result?.jobs || [];
      setJobsList(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setJobsError("Failed to fetch jobs list due to a network/server error.");
    } finally {
      setJobsLoading(false);
    }
  }

  async function refreshOneJobFromList(oneJobId) {
    if (!oneJobId) return;

    try {
      const res = await fetch(`/api/upload?jobId=${encodeURIComponent(oneJobId)}`, {
        method: "GET",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) return;

      const j = json?.result || null;
      if (!j) return;

      setJobsList((prev) =>
        prev.map((x) =>
          String(x._id || x.jobId) === String(oneJobId) ? { ...x, ...j } : x
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  function handleResourceChange(e) {
    const next = e?.target?.value;
    if (!next) return;
    setResourceKey(next);

    // reset report/job when resource changes
    setReportInfo(null);
    setDownloadUrl("");
    setJobId("");
    setJobInfo(null);
    stopPolling();

    // reset list
    setJobsList([]);
    setJobsError("");
    setJobsLoading(false);
  }

  function handleFileSelect(event) {
    if (isUploading) return; // prevent changing file while uploading

    const f = extractFirstFile(event);
    if (!f) {
      console.log("Drop zone event.detail:", event?.detail);
      setStatus(
        "Could not read file from drop-zone event. Check console for event.detail."
      );
      return;
    }

    setFile(f);
    setStatus(`Selected: ${f.name}`);

    // reset report/job when new file selected
    setReportInfo(null);
    setDownloadUrl("");
    setJobId("");
    setJobInfo(null);
    stopPolling();
  }

  function clearFile() {
    if (isUploading) return; // don't clear mid-upload
    setFile(null);
    setStatus("");
    setDropKey((k) => k + 1); // remount drop-zone to clear UI

    // clear report + job
    setReportInfo(null);
    setDownloadUrl("");
    setJobId("");
    setJobInfo(null);
    stopPolling();
  }

  function getFileNameFromPath(p) {
    if (!p) return "";
    const s = String(p);
    return s.split(/[/\\]/).pop() || s;
  }

  async function uploadOne() {
    if (!file) {
      setStatus("Please upload an Excel file first.");
      return;
    }

    const lower = String(file.name || "").toLowerCase();
    if (
      !lower.endsWith(".xlsx") &&
      !lower.endsWith(".xls") &&
      !lower.endsWith(".csv")
    ) {
      setStatus("Only .xlsx or .xls or .csv files are allowed.");
      return;
    }

    setIsUploading(true);
    setStatus("Uploading...");

    // reset previous report/job before starting
    setReportInfo(null);
    setDownloadUrl("");
    setJobId("");
    setJobInfo(null);
    stopPolling();

    try {
      const fd = new FormData();
      fd.append("resourceKey", resourceKey);
      fd.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus(json?.error || json?.message || "Upload failed.");
        return;
      }

      // ✅ products_job: expect jobId and start polling
      if (resourceKey === "products_job") {
        const createdJobId =
          json?.result?.data?.jobId || // if you wrap in sendResponse with data
          json?.result?.jobId || // if you return directly
          "";

        if (!createdJobId) {
          setStatus("Job created response is missing jobId");
          return;
        }

        setJobId(createdJobId);
        setStatus(`Job created: ${createdJobId}`);

        // clear selected file + reset drop-zone UI (job already saved on server)
        setFile(null);
        setDropKey((k) => k + 1);

        // refresh list
        fetchJobsList();

        // start polling
        pollJob(createdJobId);
        return;
      }

      // ✅ current working flow (products/orders/customers) stays same:
      setStatus(json?.message || "Uploaded successfully.");

      const data = json?.result?.data || null;
      if (data) {
        setReportInfo(data);

        const fileName = getFileNameFromPath(data.reportPath);
        if (fileName) {
          setDownloadUrl(data.reportPath);
        }
      }

      // clear selected file + reset drop-zone UI
      setFile(null);
      setDropKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setStatus("Upload failed due to a network/server error.");
    } finally {
      setIsUploading(false);
    }
  }

  const canUpload = !!file && !isUploading;
  const canClear = (!isUploading && (!!file || !!status)) || false;

  useEffect(() => {
    return () => stopPolling();
  }, []);

  // load list when products_job is selected
  useEffect(() => {
    if (resourceKey === "products_job") {
      fetchJobsList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceKey]);

  return (
    <s-page heading="Fetch Resources">
      <s-stack gap="500">
        {/* Resource selector */}
        <s-select
          label="Resource"
          value={resourceKey}
          disabled={isUploading}
          onChange={handleResourceChange}
        >
          <s-option value="products">Products</s-option>
          <s-option value="products_job">Products (Job)</s-option>
          <s-option value="orders">Orders</s-option>
          <s-option value="customers">Customers</s-option>
        </s-select>

        {/* Drop zone (key forces remount on clear) */}
        <s-drop-zone
          key={dropKey}
          label="Upload Excel (.xlsx, .xls,.csv) file here"
          accept=".xlsx,.xls,.csv"
          disabled={isUploading}
          onChange={handleFileSelect}
        />

        {/* Selected file display */}
        {file ? (
          <s-banner status="info">
            <div>
              <strong>Selected file:</strong> {file.name}
            </div>
          </s-banner>
        ) : null}

        {/* Actions */}
        <s-stack gap="300" direction="horizontal">
          <s-button
            variant="primary"
            disabled={!canUpload}
            loading={isUploading}
            onClick={uploadOne}
          >
            {isUploading ? "Uploading..." : "Upload"}
          </s-button>

          <s-button variant="secondary" disabled={!canClear} onClick={clearFile}>
            Clear
          </s-button>

          {/* Optional manual refresh while job is running */}
          {resourceKey === "products_job" && jobId ? (
            <s-button
              variant="secondary"
              disabled={isUploading}
              onClick={() => pollJob(jobId)}
            >
              Refresh job status
            </s-button>
          ) : null}
        </s-stack>

        {status ? <s-text>{status}</s-text> : null}

        {/* ✅ Job status section (ONLY for products_job) */}
        {resourceKey === "products_job" && (jobId || jobInfo) ? (
          <s-card>
            <s-stack gap="300">
              <s-text variant="headingMd">Job Status</s-text>

              <s-stack gap="200">
                {jobId ? (
                  <s-text>
                    <strong>Job ID:</strong> {jobId}
                  </s-text>
                ) : null}

                {jobInfo ? (
                  <>
                    <s-text>
                      <strong>Status:</strong> {jobInfo.status}
                    </s-text>

                    {jobInfo.error ? (
                      <s-banner status="critical">
                        <div>
                          <strong>Error:</strong> {jobInfo.error}
                        </div>
                      </s-banner>
                    ) : null}
                  </>
                ) : (
                  <s-text>Fetching job status…</s-text>
                )}
              </s-stack>

              {/* Download button when job finished */}
              {downloadUrl ? (
                <s-banner status="success">
                  <div>
                    <strong>Report:</strong>{" "}
                  {downloadUrl}
                  </div>
                </s-banner>
              ) : null}
            </s-stack>
          </s-card>
        ) : null}

        {/* ✅ Jobs list table component (ONLY for products_job) */}
        {resourceKey === "products_job" ? (
          <JobsListTable
            jobsList={jobsList}
            jobsLoading={jobsLoading}
            jobsError={jobsError}
            isUploading={isUploading}
            onRefreshList={fetchJobsList}
            onRefreshJob={refreshOneJobFromList}
            onViewJob={(job) => {
              const id = String(job._id || job.jobId || "");
              setJobId(id);
              setJobInfo(job);
              setStatus(job.message || `Selected job: ${id}`);

              if (job.status === "completed" && job.reportPath) {
                setDownloadUrl(job.reportPath);
              } else {
                setDownloadUrl("");
              }
            }}
            onDownloadReport={(job) => {
              if (job?.reportPath) {
                window.open(job.reportPath, "_blank");
                return;
              }

              // fallback by name if your backend uses /api/download-report?name=
              const name = job?.reportFileName || getFileNameFromPath(job?.reportPath);
              if (name) {
                window.open(`/api/download-report?name=${encodeURIComponent(name)}`, "_blank");
              }
            }}
          />
        ) : null}

        {/* ✅ Existing report section (shows only after normal upload) */}
        {reportInfo ? (
          <s-card>
            <s-stack gap="300">
              <s-text variant="headingMd">Upload Report</s-text>

              <s-stack gap="200">
                <s-text>
                  <strong>Total processed:</strong> {reportInfo.totalProcessed}
                </s-text>
                <s-text>
                  <strong>Report rows:</strong> {reportInfo.reportCount}
                </s-text>
                <s-text>
                  <strong>Success:</strong> {reportInfo.successCount}
                </s-text>
                <s-text>
                  <strong>Failed:</strong> {reportInfo.failedCount}
                </s-text>
                <s-text>
                  <strong>Report file:</strong>{" "}
                  <s-link>{reportInfo.reportPath}</s-link>
                </s-text>
              </s-stack>
            </s-stack>
          </s-card>
        ) : null}
      </s-stack>
    </s-page>
  );
}

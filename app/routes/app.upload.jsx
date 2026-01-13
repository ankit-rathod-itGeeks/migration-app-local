import React, { useEffect, useRef, useState } from "react";
import JobsListTable from "./components/JobsListTable"; // ✅ adjust path if needed
import JobProgressBar from "./components/JobProgressBar";


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

  // ✅ job/polling state (only for products)
  const [jobId, setJobId] = useState("");
  const [jobInfo, setJobInfo] = useState(null);
  const pollTimerRef = useRef(null);

  // ✅ job list state (only for products)
  const [jobsList, setJobsList] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");

  useEffect(() => {
    if (!jobId) return;

    stopPolling();       // safety: clear old timer
    pollJob(jobId);      // start polling automatically

    return () => stopPolling();
  }, [jobId]);

  useEffect(() => {
    // resource changed → hard reset everything job-related
    stopPolling();
    setJobId("");
    setJobInfo(null);
  }, [resourceKey]);

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
    console.log("⏳ Polling job status...");
    const id = nextJobId || jobId;
    console.log("Job ID:", id);
    if (!id) return;

    try {
      const res = await fetch(`/api/upload/status?jobId=${encodeURIComponent(id)}`, {
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
      pollTimerRef.current = setTimeout(() => pollJob(id), 1000);
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

      const res = await fetch(`/api/upload/list?resourceKey=${resourceKey}`, {
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
      const res = await fetch(`/api/upload/resource?jobId=${encodeURIComponent(oneJobId)}`, {
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

      // ✅ products: expect jobId and start polling
      // if (resourceKey === "products") {
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
      // return;
      // }

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

  // load list when products is selected
  useEffect(() => {
    fetchJobsList();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceKey]);

  return (
    <s-page heading="Fetch Resources">
      <s-stack gap="small">
        {/* Resource selector */}
        <s-select
          label="Resource"
          value={resourceKey}
          disabled={isUploading}
          onChange={handleResourceChange}
        >
          <s-option value="products">Products</s-option>
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
        <s-stack gap="base" direction="inline">
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

        </s-stack>

        {status ? <s-text>{status}</s-text> : null}
        {jobInfo && jobInfo.resourceKey === resourceKey ? (
          <JobProgressBar job={jobInfo} />
        ) : null}

        <s-card>
          <s-stack gap="300">


          </s-stack>
        </s-card>


        <JobsListTable
          jobsList={jobsList}
          jobsLoading={jobsLoading}
          jobsError={jobsError}
          isUploading={isUploading}
          renderProgress={(job) => <JobProgressBar job={job} />}
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
            const jobId = String(job?._id || job?.jobId || "");
            if (!jobId) return;

            window.open(
              `/api/upload/download?jobId=${encodeURIComponent(jobId)}`,
              "_blank"
            );
          }}
        />

      </s-stack>
    </s-page>
  );
}

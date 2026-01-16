import React, { useEffect, useRef, useState } from "react";

export default function ResourceExportModal(props) {
  const {
    modalId = "resource-export-modal",
    extensionKey = "",
    id = "",
    resourceKey = "",
    onClose,
    onSuccess,
    onQueryLoaded,
  } = props || {};

  const closeRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ DB default query state (ONLY source now)
  const [dbDefaultSql, setDbDefaultSql] = useState("");
  const [dbLoading, setDbLoading] = useState(false);

  // ✅ editor value (starts empty, then set from DB)
  const [sqlQuery, setSqlQuery] = useState("");

  // ✅ Export file state
  const [exportedFile, setExportedFile] = useState(null); // { blob, filename }

  // ✅ Store URL (products only)
  const [storeUrl, setStoreUrl] = useState("");

  // ✅ fetch default query from DB whenever resourceKey changes
  useEffect(() => {
    let cancelled = false;

    async function loadDefaultFromDb() {
      setDbDefaultSql("");
      setSqlQuery("");
      setError("");
      setExportedFile(null); // Clear previous export when resource changes
      setStoreUrl("");

      if (!resourceKey) {
        onQueryLoaded?.();
        return;
      }

      try {
        setDbLoading(true);

        const res = await fetch(
          `/api/connect/query?resourceKey=${encodeURIComponent(resourceKey)}&extensionKey=${encodeURIComponent(extensionKey)}`,
          { method: "GET" }
        );

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.status) {
          if (!cancelled) {
            setError(json?.message || "No SQL mapping found for this resource.");
            onQueryLoaded?.();
          }
          return;
        }

        const q =
          json?.result.data.query ??
          "";

        const cleaned = String(q || "").trim();

        if (!cancelled) {
          setDbDefaultSql(cleaned);
          setSqlQuery(cleaned);
          setError("");
          onQueryLoaded?.();
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to load SQL mapping from DB.");
          onQueryLoaded?.();
        }
      } finally {
        if (!cancelled) {
          setDbLoading(false);
        }
      }
    }

    loadDefaultFromDb();

    return () => {
      cancelled = true;
    };
  }, [resourceKey, onQueryLoaded]);

  function hideModal() {
    closeRef.current?.click();
    onClose?.();
  }

  function downloadFile() {
    if (!exportedFile) return;

    const { blob, filename } = exportedFile;
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  }

  async function runQuery() {
    if (!id) {
      setError("Missing id.");
      return;
    }
    if (!resourceKey) {
      setError("Select a resource first.");
      return;
    }
    if (!String(sqlQuery || "").trim()) {
      setError("SQL query is empty.");
      return;
    }
    const trimmedStoreUrl = String(storeUrl || "").trim();
    if (resourceKey === "products" && !trimmedStoreUrl) {
      setError("Store URL is required for products.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setExportedFile(null); // Clear previous export when starting new one

      const finalQuery =
        resourceKey === "products"
          ? sqlQuery.replace(/\{\{STORE_URL\}\}/g, trimmedStoreUrl)
          : sqlQuery;

      const res = await fetch(`/api/resources/sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          resourceKey,
          query: finalQuery,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const errJson = await res.json().catch(() => null);
          const msg =
            errJson?.message ||
            errJson?.error ||
            errJson?.data?.message ||
            `Request failed: ${res.status}`;
          throw new Error(msg);
        }

        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Request failed: ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("spreadsheetml")) {
        if (contentType.includes("application/json")) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message || "Expected Excel but got JSON response");
        }
        const text = await res.text().catch(() => "");
        throw new Error(text || "Expected Excel file but got an unexpected response");
      }

      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `${resourceKey}_${id || "shop"}.xlsx`;

      const blob = await res.blob();

      // Store the exported file instead of downloading immediately
      setExportedFile({ blob, filename });

      onSuccess?.({ id, resourceKey, query: sqlQuery });
      // keep modal open
      // hideModal();
    } catch (err) {
      setError(err?.message || "Export failed");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Default button uses ONLY DB value now
  const effectiveDefaultSql = dbDefaultSql;

  return (
    <s-modal
      id={modalId}
      heading="SQL Mapping"
      size="large"
      accessibilityLabel="Resource export modal"
    >
      <s-stack gap="base">
        <s-stack direction="inline" justifyContent="normal" alignItems="center" gap="base">
          <s-stack gap="none">
            <s-text tone="subdued">
              Resource: <strong>{resourceKey || "—"}</strong>
            </s-text>
            <s-text tone="subdued">
              id: <strong>{id || "—"}</strong>
            </s-text>

          </s-stack>
          {resourceKey === "products" ? (
            <s-stack>
              <s-text-field
                label="Store URL"
                placeholder="https://example.com"
                value={storeUrl}
                required
                disabled={loading || dbLoading}
                onChange={(e) => setStoreUrl(e?.target?.value ?? e?.detail?.value ?? "")}
              />
            </s-stack>
          ) : null}


        </s-stack>

        {dbLoading ? <s-banner tone="info">Loading default query…</s-banner> : null}

        {error ? <s-banner tone="critical">{error}</s-banner> : null}

        {exportedFile ? (
          <s-banner tone="success">
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-text>Excel file exported successfully!</s-text>
              <s-button variant="primary" onClick={downloadFile}>
                Download File
              </s-button>
            </s-stack>
          </s-banner>
        ) : null}

        <s-section heading="SQL query">
          <s-text-area
            value={sqlQuery}
            rows={10}
            disabled={loading || dbLoading}
            onInput={(e) => setSqlQuery(e?.target?.value ?? e?.detail?.value ?? "")}
          />
        </s-section>
      </s-stack>

      {/* Footer actions */}
      <s-button
        slot="secondary-actions"
        variant="secondary"
        disabled={loading || dbLoading || !effectiveDefaultSql}
        onClick={() => {
          setSqlQuery(effectiveDefaultSql);
          setError("");
        }}
      >
        Default
      </s-button>

      <s-button
        slot="secondary-actions"
        variant="secondary"
        disabled={loading || dbLoading}
        onClick={() => {
          setSqlQuery("");
          setError("");
        }}
      >
        Clear
      </s-button>

      {/* Hidden close (command-based) */}
      <s-button
        slot="secondary-actions"
        variant="secondary"
        ref={closeRef}
        commandFor={modalId}
        command="--hide"
        disabled={loading}
        onClick={() => {
          onClose?.();
          setError("");
          setExportedFile(null);
          setStoreUrl("");
        }}
      >
        Close
      </s-button>

      {exportedFile ? (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={downloadFile}
        >
          Download File
        </s-button>
      ) : (
        <s-button
          slot="primary-action"
          variant="primary"
          loading={loading}
          disabled={loading || dbLoading || !id || !resourceKey || !String(sqlQuery || "").trim()}
          onClick={runQuery}
        >
          {loading ? "Exporting..." : "Export Excel"}
        </s-button>
      )}
    </s-modal>
  );
}

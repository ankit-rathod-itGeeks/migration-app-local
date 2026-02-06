import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import WoocommerceFormModal from "./components/WoocommerceFormModal"; // adjust path if needed

export default function WordpressConnections() {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();
    const MODAL_ID = "Woocommerce-connect-modal";

    // ✅ API driven list state
    const [connections, setConnections] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [listError, setListError] = useState("");

    // ✅ Fetch connections list (NO pagination)
    async function fetchConnectionsList() {
        try {
            setLoadingList(true);
            setListError("");

            // ✅ list api (make sure your backend supports this)
            const res = await fetch("/api/connect/list", { method: "GET" });
            const json = await res.json().catch(() => null);

            if (!res.ok) {
                setListError(json?.message || "Failed to fetch connections list");
                setConnections([]);
                return;
            }

            // expected: { status:true, data:[...] }
            const list = json?.data || json?.result?.data || json?.result || [];
            setConnections(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error(e);
            setListError("Failed to fetch connections list due to a network/server error.");
            setConnections([]);
        } finally {
            setLoadingList(false);
        }
    }


    // load list on mount
    useEffect(() => {
        fetchConnectionsList();
    }, []);

    const filtered = useMemo(() => {
        const q = String(query || "").trim().toLowerCase();
        if (!q) return connections;

        return connections.filter((c) => {
            // support different backend field names safely
            const domain = c.domain || c.storeDomain || c.shopDomain || c.store || "";
            const WoocommerceId = c.WoocommerceId || c.Woocommerce_id || c.WoocommerceUser || "";

            return (
                String(domain).toLowerCase().includes(q) ||
                String(WoocommerceId).toLowerCase().includes(q)
            );
        });
    }, [connections, query]);

    function onChangeQuery(e) {
        const next = e?.target?.value ?? e?.detail?.value ?? "";
        setQuery(next);
    }
    const handleView = (id) => {
        console.log("handleView", id);
        navigate(`/app/Woocommerce-resources?id=${id}`);
    };
    return (
        <s-page>
            <s-button slot="primary-action" variant="primary" commandFor={MODAL_ID} command="--show">
                Connect
            </s-button>

            <s-button
                slot="secondary-action"
                variant="auto"
                icon="arrow-left"
                onClick={() => navigate(-1)}
            >
                Back
            </s-button>

            <s-section padding="base">
                <s-stack gap="base">
                    <s-text-field
                        value={query}
                        onChange={onChangeQuery}
                        placeholder="Search connections"
                        clearButton
                        onClearButtonClick={() => onChangeQuery({ target: { value: "" } })}
                    />


                    {listError ? (
                        <s-banner status="critical">
                            <div>{listError}</div>
                        </s-banner>
                    ) : null}

                    {/* Table */}
                    <s-section padding="none">
                        <s-table>
                            <s-table-header-row>
                                <s-table-header>Store domain</s-table-header>
                                <s-table-header>Woocommerce User Name</s-table-header>
                                <s-table-header>Action</s-table-header>
                            </s-table-header-row>

                            <s-table-body>
                                {loadingList ? (
                                    <s-table-row>
                                        <s-table-cell>
                                            <s-text tone="subdued">Loading…</s-text>
                                        </s-table-cell>
                                        <s-table-cell />
                                        <s-table-cell />
                                    </s-table-row>
                                ) : (
                                    <>
                                        {filtered.map((row) => {
                                            const id = row._id;
                                            const domain = row.shopifyDomain || "";
                                            const userName = row.userName || "";

                                            return (
                                                <s-table-row key={id}>
                                                    <s-table-cell>
                                                        <s-stack direction="inline" alignItems="center" gap="base">
                                                            <s-badge size="large-100" tone="info">
                                                                <s-icon type="store" />
                                                            </s-badge>

                                                            <s-stack gap="50">
                                                                <s-text>{domain}</s-text>
                                                                <s-text tone="subdued">{userName}</s-text>
                                                            </s-stack>
                                                        </s-stack>
                                                    </s-table-cell>

                                                    <s-table-cell>{userName}</s-table-cell>

                                                    <s-table-cell>
                                                        <s-button onClick={() => handleView(id)} variant="secondary">
                                                            View
                                                        </s-button>                                                    </s-table-cell>
                                                </s-table-row>
                                            );
                                        })}

                                        {!filtered.length ? (
                                            <s-table-row>
                                                <s-table-cell>
                                                    <s-text tone="subdued">No connections found.</s-text>
                                                </s-table-cell>
                                                <s-table-cell />
                                                <s-table-cell />
                                            </s-table-row>
                                        ) : null}
                                    </>
                                )}
                            </s-table-body>
                        </s-table>
                    </s-section>
                </s-stack>
            </s-section>

            <WoocommerceFormModal
                modalId={MODAL_ID}
                onSuccess={() => {
                    fetchConnectionsList();
                }}
            />
        </s-page>
    );
}


import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import ResourceExportModal from "./components/resourceExportModal.jsx"; // adjust path if needed

export default function ResourcesPage() {
    const [searchParams] = useSearchParams();
    const id = searchParams.get("id") || "";
    const navigate = useNavigate();
    const MODAL_ID = "resource-export-modal";

    const [query, setQuery] = useState("");
    const [selectedResourceKey, setSelectedResourceKey] = useState("");

    const resources = useMemo(
        () => [
            {
                key: "products",
                title: "Products",
                description: "Inventory, variants, and tags",
                status: "ready",
                badgeTone: "success",
                icon: "product",
            },
            {
                key: "customers",
                title: "Customers",
                description: "Profiles and address books",
                status: "ready",
                badgeTone: "success",
                icon: "profile",
            },
            {
                key: "orders",
                title: "Orders",
                description: "History and transactions",
                status: "ready",
                badgeTone: "success",
                icon: "order",
            },
            {
                key: "collections",
                title: "Collections",
                description: "Smart and manual groups",
                status: "ready",
                badgeTone: "success",
                icon: "collection",
            },
        ],
        []
    );

    const filtered = useMemo(() => {
        const q = String(query || "").trim().toLowerCase();
        if (!q) return resources;

        return resources.filter((r) => {
            return (
                String(r.title).toLowerCase().includes(q) ||
                String(r.description).toLowerCase().includes(q) ||
                String(r.key).toLowerCase().includes(q)
            );
        });
    }, [resources, query]);

    function onChangeQuery(e) {
        const next = e?.target?.value ?? e?.detail?.value ?? "";
        setQuery(next);
    }

    function openResource(resourceKey) {
        setSelectedResourceKey(resourceKey);
    }

    return (
        <s-page heading="Data Categories">
            <s-button slot="primary-action" variant="primary">Action</s-button>
            <s-button slot="secondary-action" variant="auto" icon="arrow-left" onClick={() => navigate(-1)}>Back</s-button>
            <s-section padding="base">
                <s-stack gap="base">
                    {!id ? (
                        <s-banner status="critical">
                            <div>
                                <strong>Missing id.</strong> Open this page with{" "}
                                <code>?id=YOUR_SHOP_ID</code>.
                            </div>
                        </s-banner>
                    ) : null}

                    <s-text-field
                        value={query}
                        onChange={onChangeQuery}
                        placeholder="Search resources..."
                        clearButton
                        onClearButtonClick={() => onChangeQuery({ target: { value: "" } })}
                    />

                    <s-stack gap="base">
                        {filtered.map((r) => (
                            <s-card key={r.key}>
                                <s-stack direction="inline" alignItems="center" justifyContent="space-between" gap="base">


                                    <s-stack gap="base" direction="inline">
                                        <s-badge size="large-100" tone="info">
                                            <s-icon size="base" type={r.icon} />
                                        </s-badge>
                                        <s-stack direction="block" >
                                            <s-text variant="headingSm">{r.title}</s-text>
                                        <s-text tone="subdued">{r.description}</s-text>
                                        </s-stack>

                                    </s-stack>

                                    {/* Right: action */}
                                    <s-button
                                        variant="primary"
                                        commandFor={MODAL_ID}
                                        command="--show"
                                        disabled={!id}
                                        onClick={() => openResource(r.key)}
                                    >
                                        View
                                    </s-button>
                                </s-stack>
                            </s-card>
                        ))}

                        {!filtered.length ? (
                            <s-card>
                                <s-text tone="subdued">No resources found.</s-text>
                            </s-card>
                        ) : null}
                    </s-stack>
                </s-stack>
            </s-section>

            {/* Modal */}
            <ResourceExportModal
                modalId={MODAL_ID}
                id={id}
                resourceKey={selectedResourceKey}
                onSuccess={() => {
                    // If later you want to refresh something on success, do it here.
                }}
                onClose={() => {
                    // Optional: clear selection when closed
                    setSelectedResourceKey("");
                }}
            />
        </s-page>
    );
}

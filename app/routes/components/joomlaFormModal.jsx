import React, { useMemo, useRef, useState } from "react";
export default function JoomlaFormModal(props) {
    const {
        modalId = "joomla-connect-modal",
        apiPath = "/api/connect/joomla",
        defaultTargetDomain = "",
        onClose,
        onSuccess,
    } = props || {};

    const closeRef = useRef(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [values, setValues] = useState({
        userName: "",
        hostName: "",
        password: "",
        dbName: "",
        targetShopDomain: defaultTargetDomain || "",
        targetShopAccessToken: "",
    });

    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState("");

    const myshopifySuffix = useMemo(() => ".myshopify.com", []);

    const setField = (key, val) => {
        setValues((prev) => ({ ...prev, [key]: val }));
        setErrors((prev) => ({ ...prev, [key]: "" }));
        setFormError("");
    };

    const resetForm = () => {
        setValues({
            userName: "",
            hostName: "",
            password: "",
            dbName: "",
            targetShopDomain: defaultTargetDomain || "",
            targetShopAccessToken: "",
        });
        setErrors({});
        setFormError("");
    };

    const hideModal = () => {
        setTimeout(() => {
            closeRef.current?.click();
        }, 0);
    };

    const normalizeHost = (h) => String(h || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const normalizeShopDomain = (d) => String(d || "").trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

    const validate = () => {
        const nextErrors = {};
        const userName = String(values.userName || "").trim();
        const dbName = String(values.dbName || "").trim();
        const hostName = normalizeHost(values.hostName);
        const password = String(values.password || "");
        const targetShopDomainRaw = normalizeShopDomain(values.targetShopDomain);
        const token = String(values.targetShopAccessToken || "").trim();

        if (!userName) nextErrors.userName = "Required";
        if (!dbName) nextErrors.dbName = "Required";
        if (!hostName) nextErrors.hostName = "Required";
        if (!password) nextErrors.password = "Required";

        if (!targetShopDomainRaw) {
            nextErrors.targetShopDomain = "Required";
        } else {
            // allow either "store-name" or full "store-name.myshopify.com"
            const hasDot = targetShopDomainRaw.includes(".");
            const validSlug = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(targetShopDomainRaw);
            const validFull = /^[a-z0-9][a-z0-9-]*[a-z0-9]\.myshopify\.com$/.test(targetShopDomainRaw);

            if (hasDot) {
                if (!validFull) nextErrors.targetShopDomain = "Use store-name.myshopify.com";
            } else {
                if (!validSlug) nextErrors.targetShopDomain = "Use only letters, numbers, and hyphens";
            }
        }

        if (!token) {
            nextErrors.targetShopAccessToken = "Required";
        } else {
            // not strict, but catches obvious issues
            if (token.length < 10) nextErrors.targetShopAccessToken = "Looks too short";
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const buildPayload = () => {
        const hostName = normalizeHost(values.hostName);

        const targetShopDomainRaw = normalizeShopDomain(values.targetShopDomain);
        const targetShopDomain = targetShopDomainRaw.includes(".")
            ? targetShopDomainRaw
            : `${targetShopDomainRaw}${myshopifySuffix}`;

        return {
            userName: String(values.userName || "").trim(),
            hostName,
            dbName: String(values.dbName || "").trim(),
            password: String(values.password || ""),
            targetShopDomain,
            targetShopAccessToken: String(values.targetShopAccessToken || "").trim(),
        };
    };

    const submit = async () => {
        if (isSubmitting) return;
        setFormError("");

        const ok = validate();
        if (!ok) return;

        const payload = buildPayload();

        setIsSubmitting(true);
        try {
            const res = await fetch(apiPath, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json().catch(() => null);

            if (!res.ok || !json?.status) {
                setFormError(json?.message || "Connection failed");
                return;
            }

            onSuccess?.(payload, json);

            // close modal first
            hideModal();

            // reset form AFTER modal hides
            setTimeout(() => {
                resetForm();
            }, 50);
        } catch (e) {
            setFormError(e?.message || "Network/server error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <s-modal id={modalId} heading="Connection Configuration" size="small" accessibilityLabel="Modal">
            {/* top error */}
            {formError ? (
                <s-banner tone="critical" heading="Fix the errors below">
                    {formError}
                </s-banner>
            ) : null}

            <s-stack gap="base">
                <s-text tone="subdued">Check Connection and Credentials</s-text>

                <s-section heading="Source credentials">
                    <s-stack gap="400">
                        <s-text-field
                            label="User Name"
                            required
                            placeholder="e.g. joomla_site_88"
                            value={values.userName}
                            error={errors.userName}
                            disabled={isSubmitting}
                            onInput={(e) => setField("userName", e.target.value)}
                            autocomplete="off"
                        />

                        <s-text-field
                            label="Host name"
                            required
                            placeholder="db.joomla-provider.com"
                            value={values.hostName}
                            error={errors.hostName}
                            disabled={isSubmitting}
                            onInput={(e) => setField("hostName", e.target.value)}
                            autocomplete="off"
                            helpText="Do not include http/https."
                        />

                        <s-text-field
                            label="Database name"
                            required
                            placeholder=""
                            value={values.dbName}
                            error={errors.dbName}
                            disabled={isSubmitting}
                            onInput={(e) => setField("dbName", e.target.value)}
                            autocomplete="off"
                        />

                        <s-password-field
                            label="Password"
                            required
                            value={values.password}
                            error={errors.password}
                            disabled={isSubmitting}
                            onInput={(e) => setField("password", e.target.value)}
                            autocomplete="current-password"
                        />
                    </s-stack>
                </s-section>

                {/* TARGET SHOPIFY STORE */}
                <s-section heading="Target Shopify store">
                    <s-stack gap="400">
                        <s-text-field
                            label="Target Shopify domain"
                            required
                            placeholder="my-store-name"
                            value={values.targetShopDomain}
                            error={errors.targetShopDomain}
                            disabled={isSubmitting}
                            onInput={(e) => setField("targetShopDomain", e.target.value)}
                            autocomplete="off"
                            helpText={`You can enter "my-store-name" (we’ll add ${myshopifySuffix}) or the full domain.`}
                        />

                        <s-password-field
                            label="Target Shopify access token"
                            required
                            placeholder="shpat_xxxxxxxxxxxxxxxxxxxxx"
                            value={values.targetShopAccessToken}
                            error={errors.targetShopAccessToken}
                            disabled={isSubmitting}
                            onInput={(e) => setField("targetShopAccessToken", e.target.value)}
                            autocomplete="off"
                            helpText='Requires "write_products" and "write_customers" scopes.'
                        />
                    </s-stack>
                </s-section>
            </s-stack>

            {/* Footer actions */}
            <s-button
                slot="secondary-actions"
                variant="secondary"
                disabled={isSubmitting}
                onClick={resetForm}
            >
                Reset
            </s-button>

            {/* hidden close action (used by hideModal) */}
            <s-button
                slot="secondary-actions"
                variant="secondary"
                ref={closeRef}
                commandFor={modalId}
                command="--hide"
                disabled={isSubmitting}
                onClick={() => {
                    resetForm();
                }}
            >
                Cancel
            </s-button>

            <s-button
                slot="primary-action"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting}
                onClick={submit}
            >
                Submit
            </s-button>
        </s-modal>
    );
}

import { useMemo, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

export default function Index() {
  const fetcher = useFetcher(); // kept (you may remove if unused)
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const MODAL_ID = "integration-modal";
  const closeRef = useRef(null); // points to the Cancel button (command --hide)

  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [clientErrors, setClientErrors] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);

  // ✅ data object in state (what you asked for)
  const [data, setData] = useState({
    joomlaId: "",
    password: "",
  });

  const cards = useMemo(
    () => [
      {
        key: "joomla",
        title: "JOOMLA",
        description: "Go to your Joomlaisland",
        logoImage: "https://images.seeklogo.com/logo-png/7/1/joomla-logo-png_seeklogo-76017.png",
        navigate: "/app/joomla"
      },
      {
        key: "wordpress",
        title: "WORDPRESS",
        description: "Go to your wordpressisland",
        logoImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Wordpress_Blue_logo.png/1200px-Wordpress_Blue_logo.png",
        navigate: "/app/wordpress"
      },
    ],
    [],
  );

  const modalHeading =
    selectedIntegration === "joomla"
      ? "Connect Joomla"
      : selectedIntegration === "wordpress"
        ? "Connect WordPress"
        : "Connect integration";

  const serverErrors =
    fetcher.data?.ok === false && fetcher.data?.errors ? fetcher.data.errors : {};

  const getConnection = async (payload) => {
    const response = await fetch("/api/connect/joomla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      result = { status: false, message: "Invalid server response" };
    }

    return result;
  };

  const handleNavigate = (path) => {
    navigate(path);
  };

  const openModalFor = (integrationKey) => {
    const isConnected = localStorage.getItem(integrationKey)
    if (isConnected === "true") {
      return navigate("/app/resources");
    }
    setSelectedIntegration(integrationKey);
    setClientErrors({});
    setData({ joomlaId: "", password: "" }); // reset fields every open
  };

  const closeModal = () => {
    // ✅ no document; close via ref to a command button
    closeRef.current?.click();
  };

  // ✅ Connect handler (no event, no FormData)
  const onConnect = async () => {
    const nextErrors = {};
    const jId = String(data.joomlaId || "").trim();
    const pwd = String(data.password || "");

    if (!selectedIntegration) nextErrors.form = "Select an integration first.";
    if (!jId) nextErrors.joomlaId = "Required";
    if (!pwd) nextErrors.password = "Required";

    if (Object.keys(nextErrors).length > 0) {
      setClientErrors(nextErrors);
      return;
    }

    setClientErrors({});
    setIsConnecting(true);

    try {
      const response = await getConnection({
        integration: selectedIntegration,
        joomlaId: jId,
        password: pwd,
      });

      if (response?.status) {
        shopify.toast.show("Connected");

        // If you must use localStorage, keep it consistent as a string
        localStorage.setItem(selectedIntegration, "true");

        closeModal();
        setSelectedIntegration(null);
        setClientErrors({});
        setData({ joomlaId: "", password: "" });

        navigate("/app/resources");
      } else {
        setClientErrors({ form: response?.message || "Connection failed" });
      }
    } catch (err) {
      setClientErrors({ form: err?.message || "Connection failed" });
    } finally {
      setIsConnecting(false);
    }
  };

  return (


    <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">
      {cards.map((card) => (
        <s-grid-item key={card.id || card.title} gridColumn="span 6" gridRow="span 1">
          <s-clickable onClick={() => handleNavigate(card.navigate)} >
            <s-card>
              <s-section heading={card.title}>
                <s-stack gap="400">
                  {/* Logo + Title row */}
                  <s-stack gap="400" direction="horizontal" alignItems="center">
                    <s-box inlineSize="100px">
                      <s-image
                        src={card.logoImage}
                        alt={card.logoAlt || `${card.title} logo`}
                        inlineSize="fill"
                        aspectRatio="1/1"
                        objectFit="cover"
                        borderRadius="base"
                      />
                    </s-box>

                    {card.subtitle ? (
                      <s-text variant="bodySm" tone="subdued">
                        {card.subtitle}
                      </s-text>
                    ) : null}
                  </s-stack>

                  {/* Description */}
                  {card.description ? (
                    <s-text variant="bodySm" tone="subdued">
                      {card.description}
                    </s-text>
                  ) : null}
                </s-stack>
              </s-section>
            </s-card>
          </s-clickable>
        </s-grid-item>
      ))}
    </s-grid>



    // <s-page heading="INTEGRATIONS" inlineSize="base">
    //   <s-section>
    //     <s-stack gap="base">
    //       {cards.map((card) => (
    //         <s-section key={card.key} heading={card.title}>
    //           <s-paragraph>{card.description}</s-paragraph>

    //           <s-button
    //             onClick={() => openModalFor(card.key)}
    //             variant="primary"
    //             commandFor={MODAL_ID}
    //             command="--show"
    //           >
    //             Connect
    //           </s-button>
    //         </s-section>
    //       ))}
    //     </s-stack>
    //   </s-section>

    //   <s-modal id={MODAL_ID} heading={modalHeading} size="base">
    //     {(clientErrors.form || serverErrors.form) && (
    //       <s-banner tone="critical" heading="Fix the errors below">
    //         {clientErrors.form || serverErrors.form}
    //       </s-banner>
    //     )}

    //     <s-stack gap="base">
    //       <s-text-field
    //         label="Joomla ID"
    //         required
    //         autocomplete="username"
    //         placeholder="Enter your Joomla ID"
    //         value={data.joomlaId}
    //         error={clientErrors.joomlaId || serverErrors.joomlaId}
    //         disabled={isConnecting}
    //         onInput={(e) =>
    //           setData((prev) => ({
    //             ...prev,
    //             joomlaId: e.target.value,
    //           }))
    //         }
    //       />

    //       <s-password-field
    //         label="Password"
    //         required
    //         autocomplete="current-password"
    //         value={data.password}
    //         error={clientErrors.password || serverErrors.password}
    //         disabled={isConnecting}
    //         onInput={(e) =>
    //           setData((prev) => ({
    //             ...prev,
    //             password: e.target.value,
    //           }))
    //         }
    //       />
    //     </s-stack>

    //     <s-button
    //       slot="secondary-actions"
    //       variant="secondary"
    //       ref={closeRef}
    //       commandFor={MODAL_ID}
    //       command="--hide"
    //       disabled={isConnecting}
    //       onClick={() => {
    //         setSelectedIntegration(null);
    //         setClientErrors({});
    //         setData({ joomlaId: "", password: "" });
    //       }}
    //     >
    //       Cancel
    //     </s-button>

    //     <s-button
    //       slot="primary-action"
    //       variant="primary"
    //       onClick={onConnect}
    //       loading={isConnecting}
    //       disabled={isConnecting || !selectedIntegration}
    //     >
    //       Connect
    //     </s-button>
    //   </s-modal>
    // </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);

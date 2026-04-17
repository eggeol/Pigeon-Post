import { useEffect, useEffectEvent, useRef, useState } from "react";

type GoogleButtonProps = {
  clientId: string;
  disabled?: boolean;
  onCredential: (credential: string) => Promise<void> | void;
};

export function GoogleButton({
  clientId,
  disabled = false,
  onCredential
}: GoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [buttonWidth, setButtonWidth] = useState(320);
  const handleCredential = useEffectEvent((credential: string) => {
    void onCredential(credential);
  });

  useEffect(() => {
    const host = containerRef.current;

    if (!host) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.max(220, Math.min(360, Math.round(host.getBoundingClientRect().width)));
      setButtonWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!clientId || disabled) {
      return;
    }

    let cancelled = false;
    let timer = 0;

    const mountButton = () => {
      const googleAccounts = window.google?.accounts?.id;

      if (!containerRef.current || cancelled) {
        return;
      }

      if (!googleAccounts) {
        timer = window.setTimeout(mountButton, 150);
        return;
      }

      containerRef.current.innerHTML = "";
      googleAccounts.initialize({
        client_id: clientId,
        callback: ({ credential }) => handleCredential(credential)
      });
      googleAccounts.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: buttonWidth,
        text: "continue_with",
        logo_alignment: "left"
      });
    };

    mountButton();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [buttonWidth, clientId, disabled, handleCredential]);

  return <div className="google-button-host" ref={containerRef} />;
}

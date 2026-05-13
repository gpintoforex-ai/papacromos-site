import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as any).standalone);
}

export default function InstallAppPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("papa-cromos-install-dismissed") === "true");

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      localStorage.setItem("papa-cromos-install-dismissed", "true");
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!installPrompt || dismissed || isStandaloneDisplay()) {
    return null;
  }

  const installApp = async () => {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome !== "accepted") return;

    setInstallPrompt(null);
  };

  const dismissPrompt = () => {
    localStorage.setItem("papa-cromos-install-dismissed", "true");
    setDismissed(true);
  };

  return (
    <div className="install-app-prompt" role="region" aria-label="Instalar aplicação">
      <div>
        <strong>Instalar Papa Cromos</strong>
        <span>Abrir como app no telemóvel ou computador.</span>
      </div>
      <button className="btn btn-primary btn-sm" type="button" onClick={installApp}>
        <Download size={14} /> Instalar
      </button>
      <button className="install-app-dismiss" type="button" onClick={dismissPrompt} title="Fechar">
        <X size={16} />
      </button>
    </div>
  );
}

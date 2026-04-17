import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  PiCompassRoseFill,
  PiEnvelopeOpenFill,
  PiFeatherFill,
  PiMailboxFill,
  PiMapPinFill,
  PiPaperPlaneTiltFill,
  PiSignOutFill,
  PiSparkleFill
} from "react-icons/pi";
import { GiDove } from "react-icons/gi";
import { GoogleButton } from "./components/GoogleButton";
import { LocationPicker } from "./components/LocationPicker";
import { api } from "./lib/api";
import { reverseGeocodeLocation } from "./lib/geoapify";
import {
  estimateFlight,
  formatCountdown,
  formatDateTime,
  formatDistance,
  formatDuration
} from "./lib/format";
import type {
  AppMessage,
  AppUser,
  MailboxPayload,
  PublicConfig,
  SelectedLocation
} from "./lib/types";

type ComposeDraft = {
  recipientQuery: string;
  selectedRecipient: AppUser | null;
  body: string;
};

type OpenedMessage = {
  message: AppMessage;
  tab: "inbox" | "outbox";
};

const emptyComposeDraft: ComposeDraft = {
  recipientQuery: "",
  selectedRecipient: null,
  body: ""
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function readBrowserLocation() {
  return new Promise<GeolocationCoordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => reject(new Error("Location access was denied.")),
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
    );
  });
}

function fromCoords(label: string, coords: GeolocationCoordinates): SelectedLocation {
  return {
    label,
    latitude: coords.latitude,
    longitude: coords.longitude
  };
}

function sameLocation(
  left: SelectedLocation | null | undefined,
  right: SelectedLocation | null | undefined
) {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.label === right.label &&
    left.latitude === right.latitude &&
    left.longitude === right.longitude
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFlightProgress(createdAt: string, deliveredAt: string, now: number) {
  const start = new Date(createdAt).getTime();
  const end = new Date(deliveredAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return clamp((now - start) / (end - start), 0, 1);
}

export default function App() {
  const [configData, setConfigData] = useState<PublicConfig | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [mailbox, setMailbox] = useState<MailboxPayload | null>(null);
  const [composeDraft, setComposeDraft] = useState<ComposeDraft>(emptyComposeDraft);
  const [dispatchMode, setDispatchMode] = useState<"home" | "current">("current");
  const [homeLocationDraft, setHomeLocationDraft] = useState<SelectedLocation | null>(null);
  const [currentLocation, setCurrentLocation] = useState<SelectedLocation | null>(null);
  const [recipientResults, setRecipientResults] = useState<AppUser[]>([]);
  const [activeTab, setActiveTab] = useState<"inbox" | "outbox">("inbox");
  const [openedMessage, setOpenedMessage] = useState<OpenedMessage | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPromptDismissedForUserId, setLocationPromptDismissedForUserId] = useState<
    string | null
  >(null);
  const [clock, setClock] = useState(Date.now());
  const [booting, setBooting] = useState(true);
  const [searching, setSearching] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [savingHomeLocation, setSavingHomeLocation] = useState(false);
  const [locatingHomeLocation, setLocatingHomeLocation] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredRecipientQuery = useDeferredValue(composeDraft.recipientQuery);

  async function resolveCurrentLocation(coords: GeolocationCoordinates) {
    const fallback = "Your current area";

    if (!configData?.geoapifyApiKey) {
      return fallback;
    }

    try {
      return (
        (await reverseGeocodeLocation({
          apiKey: configData.geoapifyApiKey,
          latitude: coords.latitude,
          longitude: coords.longitude
        })) ?? fallback
      );
    } catch {
      return fallback;
    }
  }

  async function readCurrentLocationSelection() {
    const coords = await readBrowserLocation();
    const label = await resolveCurrentLocation(coords);
    return fromCoords(label, coords);
  }

  async function refreshMailbox() {
    if (!currentUser) {
      return;
    }

    const nextMailbox = await api.getMailbox();
    startTransition(() => setMailbox(nextMailbox));
  }

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const [nextConfig, authState] = await Promise.all([
          api.getConfig(),
          api.getCurrentUser()
        ]);

        if (cancelled) {
          return;
        }

        setConfigData(nextConfig);
        setCurrentUser(authState.user);

        if (authState.user) {
          const nextMailbox = await api.getMailbox();
          if (!cancelled) {
            setMailbox(nextMailbox);
          }
        }
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : "The coop failed to load.");
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    setSearching(true);

    api
      .searchUsers(deferredRecipientQuery.trim())
      .then((response) => {
        if (!cancelled) {
          setRecipientResults(response.users);
        }
      })
      .catch((searchError) => {
        if (!cancelled) {
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Could not find roosts."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, deferredRecipientQuery]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshMailbox();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [currentUser]);

  useEffect(() => {
    setCurrentLocation(null);
    setOpenedMessage(null);
    setDispatchMode(currentUser?.homeLocation ? "home" : "current");
  }, [currentUser?.id]);

  useEffect(() => {
    setHomeLocationDraft(currentUser?.homeLocation ?? null);
  }, [
    currentUser?.id,
    currentUser?.homeLocation?.label,
    currentUser?.homeLocation?.latitude,
    currentUser?.homeLocation?.longitude
  ]);

  useEffect(() => {
    if (!currentUser) {
      setShowLocationPrompt(false);
      return;
    }

    if (currentUser.homeLocation) {
      setShowLocationPrompt(false);
      return;
    }

    setShowLocationPrompt(locationPromptDismissedForUserId !== currentUser.id);
  }, [
    currentUser,
    currentUser?.homeLocation?.label,
    currentUser?.homeLocation?.latitude,
    currentUser?.homeLocation?.longitude,
    locationPromptDismissedForUserId
  ]);

  useEffect(() => {
    if (!openedMessage && !showLocationPrompt) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (openedMessage) {
          setOpenedMessage(null);
          return;
        }

        if (showLocationPrompt && currentUser) {
          setLocationPromptDismissedForUserId(currentUser.id);
          setShowLocationPrompt(false);
        }
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentUser, openedMessage, showLocationPrompt]);

  async function handleGoogleCredential(credential: string) {
    setSigningIn(true);
    setError(null);

    try {
      const response = await api.signInWithGoogle(credential);
      setCurrentUser(response.user);
      setMailbox(await api.getMailbox());
      setNotice("Signed in.");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Google sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
      setCurrentUser(null);
      setMailbox(null);
      setCurrentLocation(null);
      setComposeDraft(emptyComposeDraft);
      setOpenedMessage(null);
      setShowLocationPrompt(false);
      setLocationPromptDismissedForUserId(null);
      setNotice("Signed out.");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Could not sign out.");
    }
  }

  function dismissLocationPrompt() {
    if (currentUser) {
      setLocationPromptDismissedForUserId(currentUser.id);
    }

    setShowLocationPrompt(false);
  }

  async function handleUseCurrentForHome() {
    setLocatingHomeLocation(true);
    setError(null);

    try {
      const nextLocation = await readCurrentLocationSelection();
      setCurrentLocation(nextLocation);
      setHomeLocationDraft(nextLocation);
      setNotice("Current perch picked. Save it as your home roost if you want to keep it.");
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : "Could not read your current perch."
      );
    } finally {
      setLocatingHomeLocation(false);
    }
  }

  async function handleSaveHomeLocation() {
    if (!homeLocationDraft) {
      setError("Pick a home roost first.");
      return;
    }

    setSavingHomeLocation(true);
    setError(null);

    try {
      const response = await api.updateProfile({
        homeLabel: homeLocationDraft.label,
        homeLatitude: homeLocationDraft.latitude,
        homeLongitude: homeLocationDraft.longitude
      });

      setCurrentUser(response.user);
      setShowLocationPrompt(false);
      setNotice("Home roost saved.");
    } catch (profileError) {
      setError(
        profileError instanceof Error ? profileError.message : "Could not save your home roost."
      );
    } finally {
      setSavingHomeLocation(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!composeDraft.selectedRecipient) {
      setError("Choose who gets the letter.");
      return;
    }

    setSendingMessage(true);
    setError(null);

    try {
      const senderLocation =
        dispatchMode === "current"
          ? await readCurrentLocationSelection()
          : currentUser?.homeLocation ?? null;

      if (!senderLocation) {
        throw new Error("Save your home roost first or switch to live current location.");
      }

      const response = await api.sendMessage(
        dispatchMode === "current"
          ? {
              recipientId: composeDraft.selectedRecipient.id,
              body: composeDraft.body,
              dispatchMode,
              senderLabel: senderLocation.label,
              senderLatitude: senderLocation.latitude,
              senderLongitude: senderLocation.longitude
            }
          : {
              recipientId: composeDraft.selectedRecipient.id,
              body: composeDraft.body,
              dispatchMode
            }
      );

      setCurrentLocation(senderLocation);

      await refreshMailbox();
      setComposeDraft(emptyComposeDraft);
      setActiveTab("outbox");
      setNotice(`Sent. Arrives ${formatDateTime(response.message.deliveredAt)}.`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The pigeon could not take off.");
    } finally {
      setSendingMessage(false);
    }
  }

  const senderPreviewLocation =
    dispatchMode === "home"
      ? currentUser?.homeLocation ?? null
      : currentLocation ?? currentUser?.homeLocation ?? null;
  const homeLocationChanged = !sameLocation(homeLocationDraft, currentUser?.homeLocation ?? null);
  const sendDisabled =
    !composeDraft.selectedRecipient ||
    !composeDraft.body.trim() ||
    (dispatchMode === "home" && !currentUser?.homeLocation);
  const composerNote =
    dispatchMode === "home"
      ? currentUser?.homeLocation
        ? "Your saved home roost will be used for this letter."
        : "Save a home roost first, or switch to live current location."
      : "Live current location is only requested when you press send.";
  const routeEmptyMessage =
    dispatchMode === "home"
      ? "Pick a friend. We will route this from your saved home roost."
      : "Pick a friend. We will use your live current location when you send.";
  const dashboardLocationLabel =
    dispatchMode === "home"
      ? currentUser?.homeLocation?.label ?? "Save a home roost"
      : currentLocation?.label ?? "Live location at send time";

  const preview = useMemo(() => {
    if (!composeDraft.selectedRecipient?.homeLocation || !senderPreviewLocation) {
      return null;
    }

    return estimateFlight(
      senderPreviewLocation,
      composeDraft.selectedRecipient.homeLocation,
      clock
    );
  }, [clock, composeDraft.selectedRecipient, senderPreviewLocation]);
  const previewProgress = (clock / 1000 % 12) / 12;

  const visibleMessages = activeTab === "inbox" ? mailbox?.inbox ?? [] : mailbox?.outbox ?? [];

  if (booting) {
    return (
      <div className="app-shell app-shell--centered">
        <div className="loading-bird">
          <GiDove />
        </div>
        <p>Opening the roost...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="background-bloom background-bloom--one" />
      <div className="background-bloom background-bloom--two" />
      <div className="background-bloom background-bloom--three" />

      <header className="topbar">
        <div className="brand">
          <span className="brand__seal">
            <GiDove />
          </span>
          <div>
            <p className="eyebrow">Delayed letters</p>
            <h1>Pigeon Post</h1>
          </div>
        </div>
        <div className="topbar__meta">
          <span className="topbar__chip">
            <PiCompassRoseFill />
            Distance-shaped delivery
          </span>
          {currentUser ? (
            <button className="ghost-button" onClick={() => void handleLogout()} type="button">
              <PiSignOutFill />
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {!currentUser ? (
        <section className="welcome-grid">
          <section className="welcome-card">
            <div className="welcome-card__art">
              <div className="welcome-card__bird">
                <GiDove />
              </div>
              <div className="welcome-card__stamp">
                <PiSparkleFill />
                Slow delivery
              </div>
            </div>
            <div className="welcome-card__copy">
              <p className="eyebrow">Slow and sweet</p>
              <h2>Write now. Arrive later.</h2>
              <p className="welcome-card__lede">
                A tiny postcard world where every letter earns its arrival instead of showing up
                instantly.
              </p>
              <div className="chip-row">
                <StatBadge icon={<PiEnvelopeOpenFill />} label="Delivery" value="Delayed" />
                <StatBadge icon={<PiMapPinFill />} label="Route" value="Distance based" />
                <StatBadge icon={<PiFeatherFill />} label="Login" value="Google" />
              </div>
            </div>
          </section>

          <aside className="signin-slot">
            <div className="signin-card">
              <div className="signin-card__content">
                <p className="eyebrow">Start</p>
                <h3>Sign in with Google</h3>
                <p className="signin-card__lede">
                  Save your roost, send a note, and let the distance decide when it lands.
                </p>
                {configData?.googleClientId ? (
                  <GoogleButton
                    clientId={configData.googleClientId}
                    disabled={signingIn}
                    onCredential={handleGoogleCredential}
                  />
                ) : (
                  <p className="muted">Add `GOOGLE_CLIENT_ID` first.</p>
                )}
                <div className="signin-card__notes">
                  <span>Distance-based delivery times</span>
                  <span>Live flight countdowns</span>
                  <span>Full-screen letter reading</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      ) : (
        <>
          <section className="dashboard-intro">
            <div className="dashboard-intro__copy">
              <p className="eyebrow dashboard-intro__eyebrow">Your pigeon desk</p>
              <div className="dashboard-intro__profile">
                <Avatar user={currentUser} />
                <div>
                  <strong>{currentUser.name}</strong>
                  <span>{currentLocation?.label ?? currentUser.homeLocation?.label ?? currentUser.email}</span>
                </div>
              </div>
              <h2>Message someone.</h2>
              <p className="dashboard-intro__sub">
                Pick a route, write a letter, and let the trip become part of the message.
              </p>
              <div className="dashboard-intro__stats">
                <CompactStat
                  icon={<PiEnvelopeOpenFill />}
                  label="Inbox"
                  value={String(mailbox?.stats.deliveredInboxCount ?? 0)}
                />
                <CompactStat
                  icon={<PiPaperPlaneTiltFill />}
                  label="Sent"
                  value={String(mailbox?.stats.totalSentCount ?? 0)}
                />
                <CompactStat
                  icon={<PiCompassRoseFill />}
                  label="Airborne"
                  value={String(mailbox?.stats.airborneToYouCount ?? 0)}
                />
              </div>
              <div className="dashboard-intro__location">
                <PiMapPinFill />
                <span>
                  {dashboardLocationLabel}
                </span>
              </div>
            </div>

            <div className="dashboard-intro__art" aria-hidden="true">
              <div className="dashboard-intro__cloud dashboard-intro__cloud--one" />
              <div className="dashboard-intro__cloud dashboard-intro__cloud--two" />
              <div className="dashboard-intro__route" />
              <div className="dashboard-intro__letter dashboard-intro__letter--from">
                <small>From</small>
                <strong>{senderPreviewLocation?.label ?? "Your place"}</strong>
              </div>
              <div className="dashboard-intro__letter dashboard-intro__letter--to">
                <small>To</small>
                <strong>
                  {composeDraft.selectedRecipient?.homeLocation?.label ?? "Someone nice"}
                </strong>
              </div>
              <div className="dashboard-intro__bird">
                <GiDove />
              </div>
            </div>
          </section>

          <section className="workspace-grid">
            <form className="card composer-card" onSubmit={handleSendMessage}>
              <p className="section-kicker">Compose</p>
              <CardHead icon={<PiPaperPlaneTiltFill />} title="Send" />

              <StepBlock index="01" title="From">
                <div className="dispatch-toggle">
                  <button
                    className={dispatchMode === "home" ? "toggle-button active" : "toggle-button"}
                    onClick={() => setDispatchMode("home")}
                    type="button"
                  >
                    Home roost
                  </button>
                  <button
                    className={dispatchMode === "current" ? "toggle-button active" : "toggle-button"}
                    onClick={() => setDispatchMode("current")}
                    type="button"
                  >
                    Live location
                  </button>
                </div>
                <p className="composer-note composer-note--tight">{composerNote}</p>
              </StepBlock>

              <StepBlock index="02" title="To">
                <label className="field">
                  <input
                    autoComplete="off"
                    spellCheck={false}
                    value={composeDraft.recipientQuery}
                    onChange={(event) =>
                      setComposeDraft((draft) => ({
                        ...draft,
                        recipientQuery: event.target.value
                      }))
                    }
                    placeholder="Search by name or email"
                  />
                </label>

                <div className="recipient-results">
                  {searching ? <p className="muted">Searching...</p> : null}
                  {recipientResults.map((candidate) => (
                    <button
                      className={`recipient-pill ${composeDraft.selectedRecipient?.id === candidate.id ? "recipient-pill--active" : ""}`}
                      key={candidate.id}
                      onClick={() =>
                        setComposeDraft((draft) => ({
                          ...draft,
                          selectedRecipient: candidate,
                          recipientQuery: candidate.name
                        }))
                      }
                      type="button"
                    >
                      <Avatar user={candidate} />
                      <span>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.homeLocation?.label}</small>
                      </span>
                    </button>
                  ))}
                  {!searching && recipientResults.length === 0 ? (
                    <p className="muted recipient-results__empty">
                      {deferredRecipientQuery.trim()
                        ? "No matching friends with saved roosts yet."
                        : "Only friends who have signed in and saved a home roost show up here."}
                    </p>
                  ) : null}
                </div>
              </StepBlock>

              <StepBlock index="03" title="Letter">
                <div className="letter-editor">
                  <p className="letter-sheet__date">{formatLetterDate(new Date().toISOString())}</p>
                  <LetterAddressBlock
                    name={composeDraft.selectedRecipient?.name ?? "Recipient"}
                    locationLabel={
                      composeDraft.selectedRecipient?.homeLocation?.label ??
                      "Choose someone to address this letter."
                    }
                  />
                  <p className="letter-sheet__salutation">
                    Dear {composeDraft.selectedRecipient?.name ?? "friend"},
                  </p>
                  <label className="letter-editor__body">
                    <textarea
                      className="letter-editor__textarea"
                      maxLength={500}
                      value={composeDraft.body}
                      onChange={(event) =>
                        setComposeDraft((draft) => ({
                          ...draft,
                          body: event.target.value
                        }))
                      }
                      placeholder={
                        "I hope this letter finds you well.\n\nI wanted to write and tell you..."
                      }
                    />
                  </label>
                  <div className="letter-sheet__closing">
                    <p>With care,</p>
                    <strong>{currentUser.name}</strong>
                  </div>
                </div>
              </StepBlock>

              <button className="primary-button" disabled={sendDisabled || sendingMessage} type="submit">
                <PiPaperPlaneTiltFill />
                {sendingMessage ? "Sending..." : "Send"}
              </button>
              <p className="composer-note">{composerNote}</p>
            </form>

            <div className="side-column">
              <section className="card roost-card">
                <p className="section-kicker">Profile</p>
                <CardHead icon={<PiMapPinFill />} title="Home Roost" />
                <LocationPicker
                  apiKey={configData?.geoapifyApiKey ?? ""}
                  busy={locatingHomeLocation}
                  emptyLabel="Save your home roost so sending is easier."
                  onClear={() => setHomeLocationDraft(null)}
                  onSelect={setHomeLocationDraft}
                  onUseCurrent={handleUseCurrentForHome}
                  placeholder="Search for your home roost"
                  value={homeLocationDraft}
                />
                <div className="roost-card__actions">
                  <button
                    className="primary-button primary-button--ink"
                    disabled={!homeLocationDraft || !homeLocationChanged || savingHomeLocation}
                    onClick={() => void handleSaveHomeLocation()}
                    type="button"
                  >
                    {savingHomeLocation
                      ? "Saving..."
                      : currentUser.homeLocation
                        ? "Update home roost"
                        : "Save home roost"}
                  </button>
                </div>
                <p className="composer-note composer-note--tight">
                  Friends appear in search once they have signed in and saved a home roost.
                </p>
              </section>

              <section className="card route-card">
                <p className="section-kicker">Preview</p>
                <CardHead icon={<PiCompassRoseFill />} title="Flight" />
                {preview ? (
                  <>
                    <FlightTrack
                      detailLabel={`Estimated ${formatDuration(preview.flightDurationSeconds)}`}
                      fromLabel={senderPreviewLocation?.label ?? "Your place"}
                      progress={previewProgress}
                      status="preview"
                      toLabel={composeDraft.selectedRecipient?.homeLocation?.label ?? "Pick a friend"}
                    />
                    <div className="preview-stats">
                      <MiniStat icon={<PiMapPinFill />} label="Distance" value={formatDistance(preview.distanceKm)} />
                      <MiniStat icon={<PiFeatherFill />} label="Flight" value={formatDuration(preview.flightDurationSeconds)} />
                      <MiniStat icon={<PiEnvelopeOpenFill />} label="Arrives" value={formatDateTime(preview.deliveredAt)} />
                    </div>
                  </>
                ) : (
                  <div className="route-card__empty">
                    <GiDove />
                    <span>{routeEmptyMessage}</span>
                  </div>
                )}
              </section>
            </div>
          </section>

          <section className="card mailbox-card">
            <p className="section-kicker">Mailbox</p>
            <div className="mailbox-card__top">
              <div className="mailbox-card__heading">
                <CardHead icon={<PiMailboxFill />} title="Mail" />
                <p className="mailbox-card__summary">
                  {activeTab === "inbox"
                    ? `${mailbox?.stats.deliveredInboxCount ?? 0} letters ready to open`
                    : `${mailbox?.stats.totalSentCount ?? 0} letters sent so far`}
                </p>
              </div>
              <div className="dispatch-toggle dispatch-toggle--mailbox">
                <button className={activeTab === "inbox" ? "toggle-button active" : "toggle-button"} onClick={() => setActiveTab("inbox")} type="button">
                  Inbox
                </button>
                <button className={activeTab === "outbox" ? "toggle-button active" : "toggle-button"} onClick={() => setActiveTab("outbox")} type="button">
                  Outbox
                </button>
              </div>
            </div>

            <div className="mail-list">
              {visibleMessages.length === 0 ? (
                <div className="empty-state">
                  <GiDove />
                  <p>{activeTab === "inbox" ? "Nothing here yet." : "No outgoing letters yet."}</p>
                </div>
              ) : (
                visibleMessages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    now={clock}
                    onOpen={() => setOpenedMessage({ message, tab: activeTab })}
                    tab={activeTab}
                  />
                ))
              )}
            </div>
          </section>
        </>
      )}

      {openedMessage ? (
        <MessageViewer
          message={openedMessage.message}
          now={clock}
          onClose={() => setOpenedMessage(null)}
          tab={openedMessage.tab}
        />
      ) : null}

      {showLocationPrompt && currentUser && !currentUser.homeLocation ? (
        <div
          className="setup-modal"
          onClick={dismissLocationPrompt}
          role="presentation"
        >
          <section
            aria-labelledby="location-setup-title"
            aria-modal="true"
            className="setup-modal__dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="setup-modal__top">
              <div>
                <p className="eyebrow">One more step</p>
                <h3 id="location-setup-title">Set your home roost</h3>
              </div>
              <button
                className="ghost-button ghost-button--small"
                onClick={dismissLocationPrompt}
                type="button"
              >
                Later
              </button>
            </div>

            <p className="setup-modal__lede">
              Add your location so friends can find your roost and your letters can leave from the
              right place.
            </p>

            <LocationPicker
              apiKey={configData?.geoapifyApiKey ?? ""}
              busy={locatingHomeLocation}
              emptyLabel="Pick your home roost to finish setup."
              onClear={() => setHomeLocationDraft(null)}
              onSelect={setHomeLocationDraft}
              onUseCurrent={handleUseCurrentForHome}
              placeholder="Search for your home roost"
              value={homeLocationDraft}
            />

            <div className="setup-modal__actions">
              <button
                className="ghost-button"
                onClick={dismissLocationPrompt}
                type="button"
              >
                Maybe later
              </button>
              <button
                className="primary-button primary-button--ink"
                disabled={!homeLocationDraft || !homeLocationChanged || savingHomeLocation}
                onClick={() => void handleSaveHomeLocation()}
                type="button"
              >
                {savingHomeLocation ? "Saving..." : "Save my home roost"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {notice || error ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {notice ? <Banner kind="notice" message={notice} onDismiss={() => setNotice(null)} /> : null}
          {error ? <Banner kind="error" message={error} onDismiss={() => setError(null)} /> : null}
        </div>
      ) : null}

      <footer className="site-footer">
        <span>Pigeon Post</span>
        <span>Letters that earn their arrival.</span>
      </footer>
    </div>
  );
}

function CardHead({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="card-head">
      <span className="panel-icon">{icon}</span>
      <div>
        <p className="card-head__eyebrow">Workspace</p>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function StepBlock({
  index,
  title,
  children
}: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="step-block">
      <div className="step-block__head">
        <span>{index}</span>
        <strong>{title}</strong>
      </div>
      {children}
    </section>
  );
}

function Banner({
  kind,
  message,
  onDismiss
}: {
  kind: "notice" | "error";
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className={`banner banner--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{message}</span>
      <button
        aria-label="Dismiss notification"
        className="banner__dismiss"
        onClick={onDismiss}
        type="button"
      >
        Close
      </button>
    </div>
  );
}

function Avatar({ user }: { user: Pick<AppUser, "name" | "avatarUrl"> }) {
  return (
    <span className="avatar">
      {user.avatarUrl ? <img alt={user.name} src={user.avatarUrl} /> : initials(user.name)}
    </span>
  );
}

function StatBadge({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="stat-badge">
      <span className="stat-badge__icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="mini-stat">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function CompactStat({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="compact-stat">
      <span className="compact-stat__icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function FlightTrack({
  fromLabel,
  toLabel,
  progress,
  status,
  detailLabel
}: {
  fromLabel: string;
  toLabel: string;
  progress: number;
  status: "delivered" | "in_flight" | "preview";
  detailLabel: string;
}) {
  const clampedProgress = clamp(progress, 0, 1);
  const style = {
    "--flight-progress": clampedProgress.toFixed(4)
  } as CSSProperties;

  return (
    <div className={`flight-track flight-track--${status}`} style={style}>
      <div aria-hidden="true" className="flight-track__sky">
        <div className="flight-track__line" />
        <div className="flight-track__stop flight-track__stop--from" />
        <div className="flight-track__stop flight-track__stop--to" />
        <div className="flight-track__bird">
          <GiDove />
        </div>
      </div>

      <div className="flight-track__labels">
        <div className="flight-track__endpoint">
          <small>From</small>
          <strong title={fromLabel}>{fromLabel}</strong>
        </div>

        <div className="flight-track__status">
          <small>{status === "preview" ? "Flight" : "Arrival"}</small>
          <strong>{detailLabel}</strong>
        </div>

        <div className="flight-track__endpoint flight-track__endpoint--to">
          <small>To</small>
          <strong title={toLabel}>{toLabel}</strong>
        </div>
      </div>
    </div>
  );
}

function MessageCard({
  message,
  now,
  tab,
  onOpen
}: {
  message: AppMessage;
  now: number;
  tab: "inbox" | "outbox";
  onOpen: () => void;
}) {
  const counterpart = tab === "inbox" ? message.sender : message.recipient;
  const flightProgress =
    message.status === "delivered"
      ? 1
      : getFlightProgress(message.createdAt, message.deliveredAt, now);
  const arrivalLabel =
    message.status === "delivered"
      ? formatDateTime(message.deliveredAt)
      : formatCountdown(message.deliveredAt, now);

  return (
    <button className="message-card message-card--button" onClick={onOpen} type="button">
      <div className="message-card__topline">
        <div>
          <p className="eyebrow">{tab === "inbox" ? "From" : "To"}</p>
          <h4>{counterpart.name}</h4>
        </div>
        <span className={`status-pill status-pill--${message.status}`}>
          {message.status === "delivered" ? "Delivered" : "Flying"}
        </span>
      </div>
      <FlightTrack
        detailLabel={arrivalLabel}
        fromLabel={message.route.from.label}
        progress={flightProgress}
        status={message.status}
        toLabel={message.route.to.label}
      />
      <div className="message-card__summary">
        <div className="message-card__stat">
          <small>{message.status === "delivered" ? "Arrived" : "Arrival"}</small>
          <strong>{arrivalLabel}</strong>
        </div>
        <div className="message-card__stat">
          <small>Flight time</small>
          <strong>{formatDuration(message.flightDurationSeconds)}</strong>
        </div>
      </div>
      <div className="message-card__footer">
        <span>{message.route.from.label} to {message.route.to.label}</span>
        <span>Open letter</span>
      </div>
    </button>
  );
}

function MessageViewer({
  message,
  now,
  tab,
  onClose
}: {
  message: AppMessage;
  now: number;
  tab: "inbox" | "outbox";
  onClose: () => void;
}) {
  const arrivalLabel =
    message.status === "delivered"
      ? formatDateTime(message.deliveredAt)
      : formatCountdown(message.deliveredAt, now);
  const deliveryLabel = message.status === "delivered" ? "Arrived" : "Arrival";

  return (
    <div
      className="mail-reader"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="mail-reader__dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <article className="letter-sheet letter-sheet--reader">
          <button
            className="ghost-button ghost-button--small mail-reader__close"
            onClick={onClose}
            type="button"
          >
            Close
          </button>

          <div className="mail-reader__paper-header">
            <div className="mail-reader__return-address">
              <small>From</small>
              <strong>{message.sender.name}</strong>
              <span>{message.route.from.label}</span>
            </div>

            <div className={`mail-reader__postal-mark mail-reader__postal-mark--${message.status}`}>
              <small>{message.status === "delivered" ? "Delivered" : "In transit"}</small>
              <strong>{arrivalLabel}</strong>
            </div>
          </div>

          <p className="letter-sheet__date">{formatLetterDate(message.createdAt)}</p>
          <LetterAddressBlock
            name={message.recipient.name}
            locationLabel={message.route.to.label}
          />
          <p className="letter-sheet__salutation">Dear {message.recipient.name},</p>
          <div className="letter-sheet__body">
            {toLetterParagraphs(message.body).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="letter-sheet__closing">
            <p>With care,</p>
            <strong>{message.sender.name}</strong>
          </div>

          <div className="mail-reader__footerline">
            <span>{deliveryLabel} {arrivalLabel}</span>
            <span>{formatDuration(message.flightDurationSeconds)} flight</span>
            <span>{formatDistance(message.distanceKm)} route</span>
          </div>
        </article>
      </section>
    </div>
  );
}

function LetterAddressBlock({
  name,
  locationLabel
}: {
  name: string;
  locationLabel: string;
}) {
  return (
    <div className="letter-sheet__address">
      <strong>{name}</strong>
      {toAddressLines(locationLabel).map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

function toAddressLines(label: string) {
  const parts = label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return [label];
  }

  const firstLine = parts.slice(0, 2).join(", ");
  const secondLine = parts.slice(2).join(", ");

  return secondLine ? [firstLine, secondLine] : [firstLine];
}

function toLetterParagraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function formatLetterDate(isoString: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long"
  }).format(new Date(isoString));
}

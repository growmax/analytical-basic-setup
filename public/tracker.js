// server/public/tracker.js

(function () {
  class WebsiteTracker {
    constructor(options = {}) {
      this.options = {
        endpoint: options.endpoint || "/analytics",
        sessionTimeout: options.sessionTimeout || 30 * 60 * 1000, // 30 minutes
        heartbeatInterval: options.heartbeatInterval || 10 * 1000, // 10 seconds
        ...options,
      };

      this.sessionData = {
        sessionId: this.generateSessionId(),
        startTime: Date.now(),
        pageViews: [],
        totalTimeSpent: 0,
        lastActiveTime: Date.now(),
      };

      this.init();
    }

    generateSessionId() {
      return "sess_" + Math.random().toString(36).substr(2, 9);
    }

    init() {
      // Initialize tracking
      this.trackPageView();
      this.setupEventListeners();
      this.startHeartbeat();

      // Handle page visibility changes
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.handlePageHidden();
        } else {
          this.handlePageVisible();
        }
      });
    }

    setupEventListeners() {
      // Track clicks
      document.addEventListener("click", (e) => {
        this.trackEvent("click", {
          element: e.target.tagName,
          className: e.target.className,
          id: e.target.id,
        });
      });

      // Track scroll depth
      let maxScroll = 0;
      document.addEventListener("scroll", () => {
        const scrollPercent = Math.round(
          ((window.scrollY + window.innerHeight) /
            document.documentElement.scrollHeight) *
            100
        );

        if (scrollPercent > maxScroll) {
          maxScroll = scrollPercent;
          this.trackEvent("scroll_depth", { depth: maxScroll });
        }
      });
    }

    startHeartbeat() {
      setInterval(() => {
        if (!document.hidden) {
          this.sessionData.totalTimeSpent +=
            Date.now() - this.sessionData.lastActiveTime;
        }
        this.sessionData.lastActiveTime = Date.now();

        this.sendData({
          type: "heartbeat",
          timeSpent: this.sessionData.totalTimeSpent,
          sessionId: this.sessionData.sessionId,
        });
      }, this.options.heartbeatInterval);
    }

    trackPageView() {
      const pageView = {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
        referrer: document.referrer,
      };

      this.sessionData.pageViews.push(pageView);
      this.sendData({
        type: "pageview",
        ...pageView,
        sessionId: this.sessionData.sessionId,
      });
    }

    trackEvent(eventName, eventData = {}) {
      this.sendData({
        type: "event",
        eventName,
        eventData,
        timestamp: Date.now(),
        sessionId: this.sessionData.sessionId,
        url: window.location.href,
      });
    }

    handlePageHidden() {
      const timeSpent = Date.now() - this.sessionData.lastActiveTime;
      this.sessionData.totalTimeSpent += timeSpent;

      this.sendData({
        type: "visibility_change",
        status: "hidden",
        timeSpent: this.sessionData.totalTimeSpent,
        sessionId: this.sessionData.sessionId,
      });
    }

    handlePageVisible() {
      this.sessionData.lastActiveTime = Date.now();

      this.sendData({
        type: "visibility_change",
        status: "visible",
        sessionId: this.sessionData.sessionId,
      });
    }

    sendData(data) {
      // Add common data to all requests
      const payload = {
        ...data,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timestamp: Date.now(),
      };

      // Send data to the specified endpoint
      if (this.options.endpoint.startsWith("http")) {
        fetch(this.options.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }).catch((error) => console.error("Tracking error:", error));
      } else {
        // For development/debugging
        console.log("Tracking data:", payload);
      }
    }
  }

  // Export to global scope
  window.WebsiteTracker = WebsiteTracker;
})();

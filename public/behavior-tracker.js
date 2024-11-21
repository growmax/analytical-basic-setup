// behavior-tracker.js
(function () {
  class BehaviorTracker {
    constructor() {
      this.sessionId = this.generateId();
      this.movements = [];
      this.clicks = [];
      this.hovers = [];
      this.scrollDepths = [];
      this.viewportHeight = window.innerHeight;
      this.pageHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight
      );
      this.init();
    }

    generateId() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
    }

    init() {
      this.trackMouseMovement();
      this.trackClicks();
      this.trackHovers();
      this.trackScroll();
      this.trackPageExit();
      this.detectProducts();
    }

    detectProducts() {
      // Automatically detect product elements
      const products = [];
      document.querySelectorAll("*").forEach((element) => {
        // Check for common product identifiers
        if (
          element.id?.toLowerCase().includes("product") ||
          element.className?.toLowerCase().includes("product") ||
          element.tagName === "PRODUCT"
        ) {
          const priceElement = element.querySelector(
            '[class*="price"], [id*="price"]'
          );
          const titleElement = element.querySelector("h1, h2, h3, h4, h5, h6");

          if (priceElement || titleElement) {
            products.push({
              element,
              price: priceElement?.textContent,
              title: titleElement?.textContent,
            });
          }
        }
      });

      this.products = products;
      this.trackProductInteractions();
    }

    trackMouseMovement() {
      let throttleTimer;
      document.addEventListener(
        "mousemove",
        (e) => {
          if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
              this.movements.push({
                x: e.pageX,
                y: e.pageY,
                timestamp: Date.now(),
              });
              throttleTimer = null;
            }, 100); // Throttle to 100ms
          }
        },
        { passive: true }
      );
    }

    trackClicks() {
      document.addEventListener(
        "click",
        (e) => {
          const element = e.target;
          const elementData = this.getElementData(element);

          this.clicks.push({
            x: e.pageX,
            y: e.pageY,
            element: elementData,
            timestamp: Date.now(),
          });

          this.sendEvent("click", {
            position: { x: e.pageX, y: e.pageY },
            element: elementData,
          });
        },
        { passive: true }
      );
    }

    trackHovers() {
      let currentHover = null;
      let hoverStartTime = null;

      document.addEventListener(
        "mouseover",
        (e) => {
          currentHover = e.target;
          hoverStartTime = Date.now();
        },
        { passive: true }
      );

      document.addEventListener(
        "mouseout",
        (e) => {
          if (currentHover && hoverStartTime) {
            const hoverDuration = Date.now() - hoverStartTime;
            if (hoverDuration > 500) {
              // Only track hovers longer than 500ms
              const elementData = this.getElementData(currentHover);
              this.hovers.push({
                element: elementData,
                duration: hoverDuration,
                timestamp: hoverStartTime,
              });

              // Check if hover is on a product
              const productData = this.getProductData(currentHover);
              if (productData) {
                this.sendEvent("product_hover", {
                  product: productData,
                  duration: hoverDuration,
                });
              }
            }
          }
        },
        { passive: true }
      );
    }

    trackScroll() {
      let throttleTimer;
      window.addEventListener(
        "scroll",
        () => {
          if (!throttleTimer) {
            throttleTimer = setTimeout(() => {
              const scrollDepth =
                (window.pageYOffset + this.viewportHeight) / this.pageHeight;
              this.scrollDepths.push({
                depth: scrollDepth,
                timestamp: Date.now(),
              });

              // Check for products in viewport
              this.checkProductsInViewport();

              throttleTimer = null;
            }, 100);
          }
        },
        { passive: true }
      );
    }

    checkProductsInViewport() {
      this.products.forEach((product) => {
        const rect = product.element.getBoundingClientRect();
        const isVisible =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.right <= window.innerWidth;

        if (isVisible) {
          this.sendEvent("product_view", {
            product: this.getProductData(product.element),
          });
        }
      });
    }

    trackProductInteractions() {
      this.products.forEach((product) => {
        const element = product.element;
        let viewStartTime = null;

        // Create IntersectionObserver for accurate view tracking
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                viewStartTime = Date.now();
              } else if (viewStartTime) {
                const viewDuration = Date.now() - viewStartTime;
                this.sendEvent("product_view_duration", {
                  product: this.getProductData(element),
                  duration: viewDuration,
                });
                viewStartTime = null;
              }
            });
          },
          { threshold: 0.5 }
        );

        observer.observe(element);
      });
    }

    getElementData(element) {
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id,
        classes: Array.from(element.classList),
        text: element.textContent?.slice(0, 100),
        href: element.href,
        type: element.type,
        value: element.value,
      };
    }

    getProductData(element) {
      // Find the closest product container
      const productElement = element.closest(
        '[class*="product"], [id*="product"]'
      );
      if (!productElement) return null;

      return {
        title: productElement.querySelector("h1, h2, h3, h4, h5, h6")
          ?.textContent,
        price: productElement.querySelector('[class*="price"]')?.textContent,
        id: productElement.id || this.generateId(),
        category: this.detectProductCategory(productElement),
      };
    }

    detectProductCategory(element) {
      // Try to detect category from breadcrumbs or URL
      const breadcrumb = document.querySelector(".breadcrumb, .breadcrumbs");
      if (breadcrumb) {
        return Array.from(breadcrumb.querySelectorAll("a"))
          .map((a) => a.textContent)
          .filter((text) => text !== "Home")
          .pop();
      }
      return null;
    }

    trackPageExit() {
      window.addEventListener("beforeunload", () => {
        this.sendEvent("session_end", {
          movements: this.movements,
          clicks: this.clicks,
          hovers: this.hovers,
          scrollDepths: this.scrollDepths,
        });
      });
    }

    sendEvent(eventType, data) {
      const event = {
        sessionId: this.sessionId,
        eventType,
        url: window.location.href,
        timestamp: Date.now(),
        data,
      };

      // Log instead of sending to server
      console.log("Analytics Event:", event);

      //   // Using sendBeacon for reliability during page unload
      navigator.sendBeacon(
        "http://localhost:3000/collect",
        JSON.stringify({
          sessionId: this.sessionId,
          eventType,
          url: window.location.href,
          timestamp: Date.now(),
          data,
        })
      );
    }
  }

  // Initialize tracker
  window.behaviorTracker = new BehaviorTracker();
})();

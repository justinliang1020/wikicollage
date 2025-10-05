/**
 * WikiViewer Web Component
 * Self-contained Wikipedia viewer with isolated styles and link handling
 */
class WikiViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.currentPage = "Cat";
    this.content = "";
    this.loading = false;
    this.pendingScrollPosition = undefined;
    this.render();
    this.setupEventListeners();
  }

  static get observedAttributes() {
    return ["page", "content", "loading", "scrollposition"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case "page":
        this.currentPage = newValue || "Cat";
        if (oldValue && oldValue !== newValue) {
          this.fetchWikiPage(this.currentPage);
        }
        break;
      case "content":
        this.content = newValue || "";
        break;
      case "loading":
        this.loading = newValue === "true";
        break;
      case "scrollposition":
        const scrollPos = parseInt(newValue) || 0;
        this.pendingScrollPosition = scrollPos;
        break;
    }
    this.render();
  }

  connectedCallback() {
    // Fetch initial content if page is set
    if (this.currentPage && !this.content) {
      this.fetchWikiPage(this.currentPage);
    }
  }

  async fetchWikiPage(page) {
    this.loading = true;
    this.render();

    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(page)}`,
      );
      const html = await response.text();
      this.content = this.processWikipediaContent(html);
      this.loading = false;
    } catch (error) {
      console.error("Failed to load Wikipedia page:", error);
      this.content = "<p>Failed to load page.</p>";
      this.loading = false;
    }

    this.render();
    
    // Apply pending scroll position after content is rendered
    if (this.pendingScrollPosition !== undefined) {
      requestAnimationFrame(() => {
        this.scrollTop = this.pendingScrollPosition;
        this.pendingScrollPosition = undefined;
      });
    }
    
    this.dispatchEvent(
      new CustomEvent("page-loaded", {
        detail: { page: this.currentPage, content: this.content },
      }),
    );
  }

  /**
   * Process Wikipedia HTML content to fix relative URLs
   * @param {string} html - Raw Wikipedia HTML
   * @returns {string} Processed HTML with absolute URLs
   */
  processWikipediaContent(html) {
    // Create a temporary DOM to process the content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Fix image sources
    const images = tempDiv.querySelectorAll("img");
    images.forEach((img) => {
      const src = img.getAttribute("src");
      if (src && src.startsWith("//")) {
        // Protocol-relative URLs
        img.setAttribute("src", "https:" + src);
        img.setAttribute("srcset", "https:" + src);
      } else if (src && src.startsWith("/")) {
        // Relative URLs - these need to be converted to Wikipedia URLs
        img.setAttribute("src", "https://en.wikipedia.org" + src);
        img.setAttribute("srcset", "https://en.wikipedia.org" + src);
      }
    });

    // Process links to handle navigation properly
    const links = tempDiv.querySelectorAll("a");
    links.forEach((link) => {
      const href = link.getAttribute("href");

      // Remove target attributes to prevent new windows/tabs
      link.removeAttribute("target");

      // Debug: log href values to understand the format
      if (href) {
        // console.log("Link href:", href);
      }

      // Check if this is a wiki article link
      const isWikiLink =
        href &&
        (href.startsWith("/wiki/") ||
          href.startsWith("./") ||
          href.startsWith("../"));

      const isAnchorLink = href && href.startsWith("#");

      // Only disable external links (not wiki links or anchor links)
      if (href && !isWikiLink && !isAnchorLink) {
        // Disable external links by removing href and styling them
        link.removeAttribute("href");
        link.style.pointerEvents = "none";
        link.style.color = "#999";
        link.style.textDecoration = "line-through";
        link.title = "External link disabled in viewer";
        // console.log("Disabled external link:", href);
      } else if (isWikiLink) {
        // console.log("Keeping wiki link:", href);
      }
    });

    return tempDiv.innerHTML;
  }

  setupEventListeners() {
    // Log scroll position on every scroll
    this.addEventListener("scroll", (event) => {
      console.log('Current scroll position:', this.scrollTop);
    });

    this.shadowRoot.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (link) {
        const href = link.getAttribute("href");

        // Match wiki links in various formats
        let newPage = null;

        if (href && href.startsWith("/wiki/")) {
          // Format: /wiki/Dog
          newPage = decodeURIComponent(href.replace("/wiki/", ""));
        } else if (href && href.startsWith("./")) {
          // Format: ./Dog
          newPage = decodeURIComponent(href.replace("./", ""));
        } else if (href && href.match(/^\.\.\/.*\/(.+)$/)) {
          // Format: ../wiki/Dog or similar
          const match = href.match(/^\.\.\/.*\/(.+)$/);
          if (match) {
            newPage = decodeURIComponent(match[1]);
          }
        }

        if (newPage) {
          event.preventDefault();
          // console.log("Navigating to wiki page:", newPage);
          this.setAttribute("page", newPage);

          // Dispatch custom event for external listeners
          this.dispatchEvent(
            new CustomEvent("pagechanged", {
              detail: { page: newPage },
            }),
          );
        }
        return;
      }

      // Handle navigate button click
      if (event.target.classList.contains("navigate-btn")) {
        const input = this.shadowRoot.querySelector(".page-input");
        const newPage = input.value.trim();
        if (newPage) {
          // console.log("Navigating to wiki page:", newPage);
          this.setAttribute("page", newPage);

          // Dispatch custom event for external listeners
          this.dispatchEvent(
            new CustomEvent("pagechanged", {
              detail: { page: newPage },
            }),
          );
        }
      }
    });

    // Handle Enter key in input
    this.shadowRoot.addEventListener("keydown", (event) => {
      if (
        event.target.classList.contains("page-input") &&
        event.key === "Enter"
      ) {
        const newPage = event.target.value.trim();
        if (newPage) {
          // console.log("Navigating to wiki page:", newPage);
          this.setAttribute("page", newPage);

          // Dispatch custom event for external listeners
          this.dispatchEvent(
            new CustomEvent("pagechanged", {
              detail: { page: newPage },
            }),
          );
        }
      }
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          overflow-y: auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Lato, Helvetica, Arial, sans-serif;
          background-color: #ffffff;
          color: #222222;
        }
        
        .container {
          max-width: 960px;
          margin: 0 auto;
          padding: 0 1em;
          line-height: 1.6;
        }
        
        .header {
          border-bottom: 3px solid #a2a9b1;
          margin-bottom: 1em;
          padding-bottom: 0.5em;
          position: sticky;
          top: 0;
          background-color: #ffffff;
          z-index: 100;
        }
        
        .title {
          margin: 0.5em 0 0.2em 0;
          font-size: 28px;
          font-weight: normal;
          font-family: "Linux Libertine", "Georgia", "Times", serif;
          color: #000;
        }
        
        .page-controls {
          margin: 0 0 0.5em 0;
          display: flex;
          align-items: center;
          gap: 0.5em;
          flex-wrap: wrap;
        }
        
        .page-controls label {
          color: #54595d;
          font-size: 13px;
          white-space: nowrap;
        }
        
        .page-input {
          padding: 0.3em 0.5em;
          border: 1px solid #a2a9b1;
          border-radius: 2px;
          font-size: 13px;
          min-width: 200px;
          flex: 1;
        }
        
        .navigate-btn {
          padding: 0.3em 0.8em;
          background-color: #0645ad;
          color: white;
          border: none;
          border-radius: 2px;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
        }
        
        .navigate-btn:hover {
          background-color: #0b0080;
        }
        
        .loading {
          color: #54595d;
          font-style: italic;
          font-size: 14px;
        }
        
        .content {
          line-height: 1.6;
          font-size: 14px;
        }
        
        /* Wikipedia content styles */
        .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
          font-family: "Linux Libertine", "Georgia", "Times", serif;
          font-weight: normal;
          margin: 0.5em 0;
          border-bottom: none;
          color: #000;
        }
        
        .content h1 {
          font-size: 2.3em;
          border-bottom: 3px solid #a2a9b1;
          padding-bottom: 0.25em;
          margin-bottom: 0.6em;
        }
        
        .content h2 {
          font-size: 1.8em;
          border-bottom: 1px solid #a2a9b1;
          padding-bottom: 0.25em;
          margin-top: 1em;
        }
        
        .content h3 {
          font-size: 1.4em;
          margin-top: 0.8em;
        }
        
        .content p {
          margin: 0.5em 0 1em 0;
        }
        
        .content a {
          color: #0645ad;
          text-decoration: none;
        }
        
        .content a:hover {
          text-decoration: underline;
        }
        
        .content a:visited {
          color: #0b0080;
        }
        
        .content a.new {
          color: #ba0000;
        }
        
        .content a.external {
          color: #36b;
        }
        
        .content img {
          max-width: 100%;
          height: auto;
        }
        
        .content table {
          border-collapse: collapse;
          margin: 1em 0;
          background-color: #ffffff;
        }
        
        .content th,
        .content td {
          border: 1px solid #a2a9b1;
          padding: 0.2em 0.4em;
          vertical-align: top;
        }
        
        .content th {
          background-color: #eaecf0;
          font-weight: bold;
          text-align: center;
        }
        
        .content .wikitable {
          border: 1px solid #a2a9b1;
          border-collapse: collapse;
          margin: 1em 0;
          background-color: #f8f9fa;
        }
        
        .content blockquote {
          border-left: 4px solid #eaecf0;
          margin: 1em 0;
          padding-left: 1em;
          color: #54595d;
          font-style: italic;
        }
        
        .content pre {
          background-color: #f6f6f6;
          border: 1px solid #ddd;
          padding: 1em;
          overflow-x: auto;
          font-family: "Courier New", Courier, monospace;
          font-size: 13px;
        }
        
        .content code {
          background-color: #f6f6f6;
          border: 1px solid #ddd;
          padding: 1px 4px;
          font-family: "Courier New", Courier, monospace;
          font-size: 13px;
        }
        
        .content .infobox {
          float: right;
          clear: right;
          width: 22em;
          margin: 0 0 1em 1em;
          border: 1px solid #a2a9b1;
          background-color: #f8f9fa;
          padding: 3px;
          font-size: 88%;
          line-height: 1.5em;
        }
        
        .content .infobox th {
          background-color: #ccccff;
          text-align: center;
          font-size: 125%;
        }
        
        .content .navbox {
          border: 1px solid #a2a9b1;
          clear: both;
          font-size: 88%;
          margin: 1em auto 0;
          padding: 1px;
          width: 100%;
          background-color: #f8f9fa;
        }
        
        .content .thumbinner {
          border: 1px solid #c8ccd1;
          padding: 3px;
          background-color: #f8f9fa;
          font-size: 94%;
          text-align: center;
          overflow: hidden;
          min-width: 100px;
        }
        
        .content .thumb {
          margin-bottom: 0.5em;
        }
        
        .content .tright {
          float: right;
          clear: right;
          margin: 0.5em 0 1.3em 1.4em;
        }
        
        .content .tleft {
          float: left;
          clear: left;
          margin: 0.5em 1.4em 1.3em 0;
        }
        
        .content .thumbcaption {
          border: none;
          line-height: 1.4em;
          padding: 3px;
          font-size: 94%;
          text-align: left;
        }
        
        .content ul, .content ol {
          margin: 0.3em 0 0 1.6em;
          padding: 0;
        }
        
        .content li {
          margin-bottom: 0.1em;
        }
        
        .content .mbox {
          background-color: #f8f9fa;
          border: 1px solid #a2a9b1;
          padding: 0.25em 0.9em;
          margin: 0.5em 0;
        }
        
        .content .hatnote {
          font-style: italic;
          padding-left: 1.6em;
          margin-bottom: 0.5em;
        }
        
        /* Wikipedia-specific class styling */
        .content .sidebar {
          float: right;
          clear: right;
          margin: 0 0 1em 1em;
          background: #f8f9fa;
          border: 1px solid #a2a9b1;
          padding: 0.2em;
          width: 22.0em;
          font-size: 88%;
          line-height: 1.25em;
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          :host {
            background-color: #0d1117;
            color: #e6edf3;
          }
          
          .header {
            border-bottom-color: #30363d;
            background-color: #0d1117;
          }
          
          .title {
            color: #e6edf3;
          }
          
          .page-controls label {
            color: #7d8590;
          }
          
          .page-input {
            background-color: #21262d;
            border-color: #30363d;
            color: #e6edf3;
          }
          
          .navigate-btn {
            background-color: #58a6ff;
          }
          
          .navigate-btn:hover {
            background-color: #bc8cff;
          }
          
          .content {
            color: #e6edf3;
          }
          
          .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
            color: #e6edf3;
            border-bottom-color: #30363d;
          }
          
          .content a {
            color: #58a6ff;
          }
          
          .content a:visited {
            color: #bc8cff;
          }
          
          .content a.new {
            color: #f85149;
          }
          
          .content table {
            background-color: #161b22;
          }
          
          .content th {
            background-color: #21262d;
          }
          
          .content th,
          .content td {
            border-color: #30363d;
          }
          
          .content .wikitable {
            background-color: #0d1117;
            border-color: #30363d;
          }
          
          .content pre {
            background-color: #161b22;
            border-color: #30363d;
          }
          
          .content code {
            background-color: #161b22;
            border-color: #30363d;
          }
          
          .content .infobox {
            background-color: #161b22;
            border-color: #30363d;
          }
          
          .content .infobox th {
            background-color: #1f2937;
          }
          
          .content .navbox {
            border-color: #30363d;
            background-color: #161b22;
          }
          
          .content .thumbinner {
            background-color: #161b22;
            border-color: #30363d;
          }
          
          .content .mbox {
            background-color: #161b22;
            border-color: #30363d;
          }
          
          .content .sidebar {
            background-color: #161b22;
            border-color: #30363d;
          }
        }
      </style>
      
      <div class="container">
        <div class="header">
          <h1 class="title">WikiCollage</h1>
          <div class="page-controls">
            <label for="page-input">View page:</label>
            <input type="text" class="page-input" value="${this.currentPage}" placeholder="Enter Wikipedia page name">
            <button class="navigate-btn">Go</button>
          </div>
          ${this.loading ? '<p class="loading">Loading...</p>' : ""}
        </div>
        <div class="content">${this.content}</div>
      </div>
    `;
  }
}

// Register the custom element
customElements.define("wiki-viewer", WikiViewer);
